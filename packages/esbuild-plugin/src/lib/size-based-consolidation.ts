import { Metafile } from 'esbuild';
import { OutputPath, MergeStrategyMap } from './merge-strategy-v2';
import { ChunkSizeInfo, validateCombinedSize } from './chunk-size-analyzer';
import { MergeCandidate, detectMergeCandidates, filterConflictingCandidates } from './merge-candidate-detector';

/**
 * Constraints for chunk merging to ensure optimal bundle characteristics
 */
export interface MergingConstraints {
  /** Maximum combined size in bytes for merged chunks (default: 32768 = 32kb) */
  maxCombinedSize: number;
  /** Preserve critical path chunks separate from other chunks */
  preserveCriticalPath: boolean;
  /** Don't merge chunks across dynamic import boundaries */
  respectDynamicBoundaries: boolean;
  /** Minimum priority score required for a merge to be applied */
  minPriorityScore: number;
  /** Maximum number of chunks that can be merged in a single operation */
  maxChunksPerMerge: number;
}

/**
 * Result of applying size-based consolidation
 */
export interface ConsolidationResult {
  /** Updated merge strategy with size-based consolidations applied */
  mergeStrategy: MergeStrategyMap;
  /** Applied merge operations for logging and analysis */
  appliedMerges: AppliedMerge[];
  /** Merge candidates that were rejected due to constraints */
  rejectedCandidates: RejectedCandidate[];
  /** Summary statistics of the consolidation process */
  summary: ConsolidationSummary;
}

/**
 * Information about a merge that was successfully applied
 */
export interface AppliedMerge {
  /** Merge candidate that was applied */
  candidate: MergeCandidate;
  /** Generated merge key for the consolidated chunk */
  mergeKey: string;
  /** Reason the merge was applied */
  reason: string;
}

/**
 * Information about a merge candidate that was rejected
 */
export interface RejectedCandidate {
  /** Merge candidate that was rejected */
  candidate: MergeCandidate;
  /** Reason for rejection */
  reason: string;
  /** Constraint that was violated, if applicable */
  violatedConstraint?: keyof MergingConstraints;
}

/**
 * Summary statistics of the consolidation process
 */
export interface ConsolidationSummary {
  /** Number of merge candidates considered */
  totalCandidates: number;
  /** Number of merges successfully applied */
  appliedMerges: number;
  /** Number of candidates rejected due to constraints */
  rejectedCandidates: number;
  /** Total size reduction achieved (in bytes) */
  sizeReduction: number;
  /** Number of HTTP requests reduced */
  requestReduction: number;
}

const DEFAULT_CONSTRAINTS: MergingConstraints = {
  maxCombinedSize: 32768, // 32kb
  preserveCriticalPath: true,
  respectDynamicBoundaries: true,
  minPriorityScore: 20,
  maxChunksPerMerge: 4,
};

/**
 * Apply size-based chunk consolidation to an existing merge strategy
 * 
 * This function implements the core consolidation logic:
 * 1. Sort candidates by priority score
 * 2. For each candidate:
 *    - Check size constraints (combined < maxCombinedSize)
 *    - Verify no critical path violations
 *    - Ensure no dynamic boundary crossings
 *    - Apply merge if all checks pass
 * 3. Update MergeStrategyMap with consolidated chunks
 * 
 * @param candidates - Detected merge candidates
 * @param currentStrategy - Current merge strategy to extend
 * @param sizeInfo - Chunk size information for validation
 * @param metafile - esbuild metafile for constraint checking
 * @param constraints - Consolidation constraints
 * @returns Consolidation result with updated strategy and statistics
 */
export function applySizeBasedMerging(
  candidates: MergeCandidate[],
  currentStrategy: MergeStrategyMap,
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  metafile: Metafile,
  constraints: Partial<MergingConstraints> = {}
): ConsolidationResult {
  const mergeConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  
  // Clone the current strategy to avoid mutation
  const updatedStrategy = new Map(currentStrategy);
  const appliedMerges: AppliedMerge[] = [];
  const rejectedCandidates: RejectedCandidate[] = [];
  
  // Track chunks that have been merged to avoid conflicts
  const mergedChunks = new Set<OutputPath>();
  
  // Initialize merged chunks from current strategy
  for (const chunkGroup of currentStrategy.values()) {
    for (const chunk of chunkGroup) {
      mergedChunks.add(chunk);
    }
  }
  
  // Process candidates in priority order (highest priority first)
  const sortedCandidates = [...candidates].sort((a, b) => b.priority - a.priority);
  
  console.log(`🎯 Processing ${sortedCandidates.length} candidates for consolidation...`);
  
  for (const candidate of sortedCandidates.slice(0, 10)) { // Process first 10 for debugging
    console.log(`🔍 Validating candidate [${candidate.chunks.slice(0,2).join(', ')}${candidate.chunks.length > 2 ? '...' : ''}] priority=${candidate.priority}`);
    
    const validationResult = validateMergeCandidate(
      candidate,
      sizeInfo,
      metafile,
      mergedChunks,
      mergeConstraints
    );
    
    console.log(`  ${validationResult.isValid ? '✅' : '❌'} ${validationResult.reason}`);
    
    if (validationResult.isValid) {
      // Apply the merge
      const mergeKey = generateMergeKey(candidate.chunks);
      updatedStrategy.set(mergeKey, [...candidate.chunks]);
      
      // Mark chunks as merged
      for (const chunk of candidate.chunks) {
        mergedChunks.add(chunk);
      }
      
      appliedMerges.push({
        candidate,
        mergeKey,
        reason: `Applied ${candidate.mergeReason} merge (priority: ${candidate.priority})`
      });
      
      console.log(`  🎉 Applied merge: ${mergeKey}`);
    } else {
      rejectedCandidates.push({
        candidate,
        reason: validationResult.reason,
        violatedConstraint: validationResult.violatedConstraint
      });
    }
  }
  
  console.log(`✅ Applied ${appliedMerges.length} merges, rejected ${rejectedCandidates.length}`);
  
  // Process remaining candidates if we got some successful merges
  for (const candidate of sortedCandidates.slice(10)) {
    const validationResult = validateMergeCandidate(
      candidate,
      sizeInfo,
      metafile,
      mergedChunks,
      mergeConstraints
    );
    
    if (validationResult.isValid) {
      const mergeKey = generateMergeKey(candidate.chunks);
      updatedStrategy.set(mergeKey, [...candidate.chunks]);
      
      for (const chunk of candidate.chunks) {
        mergedChunks.add(chunk);
      }
      
      appliedMerges.push({
        candidate,
        mergeKey,
        reason: `Applied ${candidate.mergeReason} merge (priority: ${candidate.priority})`
      });
    } else {
      rejectedCandidates.push({
        candidate,
        reason: validationResult.reason,
        violatedConstraint: validationResult.violatedConstraint
      });
    }
  }
  
  // Calculate summary statistics
  const summary = calculateConsolidationSummary(
    candidates,
    appliedMerges,
    rejectedCandidates,
    sizeInfo
  );
  
  return {
    mergeStrategy: updatedStrategy,
    appliedMerges,
    rejectedCandidates,
    summary
  };
}

/**
 * Result of validating a merge candidate against constraints
 */
interface ValidationResult {
  isValid: boolean;
  reason: string;
  violatedConstraint?: keyof MergingConstraints;
}

/**
 * Validate that a merge candidate satisfies all constraints
 */
function validateMergeCandidate(
  candidate: MergeCandidate,
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  metafile: Metafile,
  mergedChunks: Set<OutputPath>,
  constraints: MergingConstraints
): ValidationResult {
  
  // Check if any chunks are already merged
  const conflictingChunks = candidate.chunks.filter(chunk => mergedChunks.has(chunk));
  if (conflictingChunks.length > 0) {
    return {
      isValid: false,
      reason: `Chunks already merged: ${conflictingChunks.join(', ')}`
    };
  }
  
  // Check priority threshold
  if (candidate.priority < constraints.minPriorityScore) {
    return {
      isValid: false,
      reason: `Priority score ${candidate.priority} below minimum ${constraints.minPriorityScore}`,
      violatedConstraint: 'minPriorityScore'
    };
  }
  
  // Check chunk count limit
  if (candidate.chunks.length > constraints.maxChunksPerMerge) {
    return {
      isValid: false,
      reason: `Chunk count ${candidate.chunks.length} exceeds maximum ${constraints.maxChunksPerMerge}`,
      violatedConstraint: 'maxChunksPerMerge'
    };
  }
  
  // Check size constraints
  if (!validateCombinedSize(candidate.chunks, sizeInfo, constraints.maxCombinedSize)) {
    return {
      isValid: false,
      reason: `Combined size ${candidate.combinedSize} exceeds maximum ${constraints.maxCombinedSize}`,
      violatedConstraint: 'maxCombinedSize'
    };
  }
  
  // Check critical path preservation
  if (constraints.preserveCriticalPath) {
    const criticalPathViolation = checkCriticalPathViolation(candidate.chunks, metafile);
    if (criticalPathViolation) {
      return {
        isValid: false,
        reason: criticalPathViolation,
        violatedConstraint: 'preserveCriticalPath'
      };
    }
  }
  
  // Check dynamic boundary respect
  if (constraints.respectDynamicBoundaries) {
    const dynamicBoundaryViolation = checkDynamicBoundaryViolation(candidate.chunks, metafile);
    if (dynamicBoundaryViolation) {
      return {
        isValid: false,
        reason: dynamicBoundaryViolation,
        violatedConstraint: 'respectDynamicBoundaries'
      };
    }
  }
  
  return { isValid: true, reason: 'All constraints satisfied' };
}

/**
 * Check if merging chunks would violate critical path constraints
 * Critical path chunks are those directly imported by the main entry point
 */
function checkCriticalPathViolation(chunks: OutputPath[], metafile: Metafile): string | null {
  // Find the main entry point by looking for the largest chunk with an entryPoint
  // or the one that matches common main entry patterns
  let mainEntryPoint: [string, any] | null = null;
  let largestSize = 0;
  
  for (const [outputPath, outputInfo] of Object.entries(metafile.outputs)) {
    if (outputInfo.entryPoint) {
      // Prioritize entries that look like main entries
      const isMainLike = outputInfo.entryPoint.includes('main.') || 
                        outputInfo.entryPoint.includes('index.') ||
                        outputPath.includes('main') ||
                        outputPath.includes('polyfills');
      
      const size = outputInfo.bytes || 0;
      
      if (isMainLike || (size > largestSize && size > 10000)) { // Only consider reasonably large entries
        mainEntryPoint = [outputPath, outputInfo];
        largestSize = size;
      }
    }
  }
  
  if (!mainEntryPoint) {
    return null; // No clear main entry point, skip this check
  }
  
  const [entryPath, entryInfo] = mainEntryPoint;
  
  console.log(`  🔍 Critical path check against main entry: ${entryPath} (${entryInfo.bytes} bytes)`);
  
  if (!entryInfo.imports) {
    return null;
  }
  
  const directImports = entryInfo.imports
    .filter(imp => !imp.external && imp.kind !== 'dynamic-import')
    .map(imp => imp.path);
  
  const criticalChunks = chunks.filter(chunk => directImports.includes(chunk));
  if (criticalChunks.length > 0) {
    return `Chunks ${criticalChunks.join(', ')} are on critical path from ${entryPath}`;
  }
  
  return null;
}

/**
 * Check if merging chunks would cross dynamic import boundaries
 */
function checkDynamicBoundaryViolation(chunks: OutputPath[], metafile: Metafile): string | null {
  // Build map of dynamic import relationships
  const dynamicImports = new Map<OutputPath, Set<OutputPath>>();
  
  for (const [outputPath, outputInfo] of Object.entries(metafile.outputs)) {
    if (!outputInfo.imports) continue;
    
    const dynImports = new Set<OutputPath>();
    for (const imp of outputInfo.imports) {
      if (!imp.external && imp.kind === 'dynamic-import') {
        dynImports.add(imp.path);
      }
    }
    
    if (dynImports.size > 0) {
      dynamicImports.set(outputPath, dynImports);
    }
  }
  
  // Check if chunks span across dynamic boundaries
  for (const [importer, importedSet] of dynamicImports) {
    const importerInGroup = chunks.includes(importer);
    const importedInGroup = chunks.some(chunk => importedSet.has(chunk));
    
    if (importerInGroup && importedInGroup) {
      return `Merging would cross dynamic import boundary between ${importer} and its dynamic imports`;
    }
  }
  
  return null;
}

/**
 * Generate a unique merge key for a set of chunks
 */
function generateMergeKey(chunks: OutputPath[]): string {
  // Sort chunks to ensure consistent key generation
  const sortedChunks = [...chunks].sort();
  
  // Create a hash-like key based on chunk names
  const keyBase = sortedChunks.join('|');
  
  // Simple hash function for generating merge keys
  let hash = 0;
  for (let i = 0; i < keyBase.length; i++) {
    const char = keyBase.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Return a human-readable merge key
  const hashStr = Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
  return `size-merge-${hashStr}`;
}

/**
 * Calculate summary statistics for the consolidation process
 */
function calculateConsolidationSummary(
  candidates: MergeCandidate[],
  appliedMerges: AppliedMerge[],
  rejectedCandidates: RejectedCandidate[],
  sizeInfo: Map<OutputPath, ChunkSizeInfo>
): ConsolidationSummary {
  
  // Calculate size reduction
  let sizeReduction = 0;
  for (const merge of appliedMerges) {
    // Size reduction comes from reduced HTTP overhead, not actual file size reduction
    // For estimation, assume ~500 bytes overhead per HTTP request saved
    const httpOverheadSaved = (merge.candidate.chunks.length - 1) * 500;
    sizeReduction += httpOverheadSaved;
  }
  
  // Calculate request reduction (each merge reduces requests by chunks.length - 1)
  const requestReduction = appliedMerges.reduce((total, merge) => {
    return total + (merge.candidate.chunks.length - 1);
  }, 0);
  
  return {
    totalCandidates: candidates.length,
    appliedMerges: appliedMerges.length,
    rejectedCandidates: rejectedCandidates.length,
    sizeReduction,
    requestReduction
  };
}

/**
 * High-level function to perform complete size-based consolidation
 * 
 * This combines all the consolidation steps:
 * 1. Detect merge candidates
 * 2. Filter conflicting candidates  
 * 3. Apply size-based merging with constraints
 * 
 * @param sizeInfo - Chunk size information
 * @param currentStrategy - Current merge strategy
 * @param metafile - esbuild metafile
 * @param constraints - Merging constraints
 * @returns Complete consolidation result
 */
export function performSizeBasedConsolidation(
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  currentStrategy: MergeStrategyMap,
  metafile: Metafile,
  constraints: Partial<MergingConstraints> = {}
): ConsolidationResult {
  
  // Step 1: Detect merge candidates
  const allCandidates = detectMergeCandidates(sizeInfo, currentStrategy, metafile, {
    maxChunksPerMerge: constraints.maxChunksPerMerge || DEFAULT_CONSTRAINTS.maxChunksPerMerge,
    analyzeLoadTiming: true
  });
  
  // Step 2: Filter conflicting candidates
  const viableCandidates = filterConflictingCandidates(allCandidates, currentStrategy);
  
  // Step 3: Apply size-based merging
  return applySizeBasedMerging(
    viableCandidates,
    currentStrategy,
    sizeInfo,
    metafile,
    constraints
  );
}
