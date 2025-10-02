import { Metafile } from 'esbuild';
import { OutputPath, MergeStrategyMap } from './merge-strategy-v2';
import { ChunkSizeInfo } from './chunk-size-analyzer';

/**
 * Represents a candidate set of chunks that could be merged together
 */
export interface MergeCandidate {
  /** Chunks to be merged together */
  chunks: OutputPath[];
  /** Combined raw size in bytes of all chunks */
  combinedSize: number;
  /** Estimated combined gzip size */
  combinedGzipSize: number;
  /** Reason for considering this merge */
  mergeReason: 'size-optimization' | 'shared-dependencies' | 'geographic-proximity' | 'load-timing';
  /** Priority score (higher = merge first) */
  priority: number;
  /** Number of shared dependencies between chunks */
  sharedDependencyCount: number;
  /** Distance in dependency graph (lower = closer) */
  dependencyDistance: number;
  /** Load timing correlation (0-1, higher = more likely to be requested together) */
  loadTimingCorrelation: number;
}

/**
 * Options for configuring merge candidate detection
 */
export interface CandidateDetectionOptions {
  /** Maximum number of chunks to consider merging together */
  maxChunksPerMerge?: number;
  /** Minimum shared dependency count to consider geographic proximity */
  minSharedDependencies?: number;
  /** Maximum dependency distance to consider chunks as geographically close */
  maxDependencyDistance?: number;
  /** Whether to analyze load timing patterns */
  analyzeLoadTiming?: boolean;
}

const DEFAULT_DETECTION_OPTIONS: Required<CandidateDetectionOptions> = {
  maxChunksPerMerge: 4,
  minSharedDependencies: 1,
  maxDependencyDistance: 3,
  analyzeLoadTiming: true,
};

/**
 * Detect potential merge candidates from small chunks
 * 
 * Analyzes chunks based on:
 * 1. Shared Dependencies - chunks importing common modules (highest priority)
 * 2. Geographic Proximity - chunks close in dependency graph
 * 3. Size Efficiency - combinations that maximize size reduction
 * 4. Load Timing - chunks likely to be requested together
 * 
 * @param sizeInfo - Map of chunk size information
 * @param currentStrategy - Current merge strategy to avoid conflicts
 * @param metafile - esbuild metafile for dependency analysis
 * @param options - Configuration options
 * @returns Array of merge candidates sorted by priority
 */
export function detectMergeCandidates(
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  currentStrategy: MergeStrategyMap,
  metafile: Metafile,
  options: CandidateDetectionOptions = {}
): MergeCandidate[] {
  const opts = { ...DEFAULT_DETECTION_OPTIONS, ...options };
  
  // Get eligible chunks (small chunks not already merged)
  const eligibleChunks = getEligibleChunks(sizeInfo, currentStrategy);
  
  if (eligibleChunks.length < 2) {
    return []; // Need at least 2 chunks to merge
  }
  
  const candidates: MergeCandidate[] = [];
  
  console.log(`🔍 Generating combinations from ${eligibleChunks.length} eligible chunks...`);
  
  // Generate all possible combinations of eligible chunks
  const combinations = generateChunkCombinations(eligibleChunks, opts.maxChunksPerMerge);
  
  console.log(`📊 Generated ${combinations.length} combinations to analyze`);
  
  for (const chunks of combinations) {
    const candidate = analyzeChunkCombination(chunks, sizeInfo, metafile, opts);
    console.log(`🎯 Candidate [${chunks.slice(0,2).join(', ')}${chunks.length > 2 ? '...' : ''}]: priority=${candidate.priority}, reason=${candidate.mergeReason}`);
    
    if (candidate.priority > 0) { // Only include candidates with positive priority
      candidates.push(candidate);
    }
  }
  
  console.log(`✅ Found ${candidates.length} viable merge candidates`);
  
  if (candidates.length === 0 && combinations.length > 0) {
    console.log(`⚠️  All ${combinations.length} candidates had priority <= 0`);
  }
  
  // Sort by priority (highest first)
  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Get chunks eligible for size-based merging
 */
function getEligibleChunks(
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  currentStrategy: MergeStrategyMap
): OutputPath[] {
  const alreadyMerged = new Set<OutputPath>();
  
  // Mark chunks that are already part of merge groups
  for (const chunkGroup of currentStrategy.values()) {
    for (const chunk of chunkGroup) {
      alreadyMerged.add(chunk);
    }
  }
  
  return Array.from(sizeInfo.entries())
    .filter(([path, info]) => info.isEligible && !alreadyMerged.has(path))
    .map(([path]) => path);
}

/**
 * Generate valid combinations of chunks up to maxSize with reasonable limits
 */
function generateChunkCombinations(chunks: OutputPath[], maxSize: number): OutputPath[][] {
  const combinations: OutputPath[][] = [];
  
  // Limit the number of chunks we consider to prevent combinatorial explosion
  const MAX_CHUNKS_TO_CONSIDER = 50;
  const chunksToConsider = chunks.slice(0, Math.min(MAX_CHUNKS_TO_CONSIDER, chunks.length));
  
  // Limit combination size to prevent stack overflow
  const MAX_COMBINATION_SIZE = Math.min(5, maxSize);
  
  // Generate combinations of size 2 to maxSize
  for (let size = 2; size <= Math.min(MAX_COMBINATION_SIZE, chunksToConsider.length); size++) {
    const sizeCombinations = getCombinations(chunksToConsider, size);
    combinations.push(...sizeCombinations);
    
    // Limit total combinations to prevent memory issues
    if (combinations.length > 1000) {
      break;
    }
  }
  
  return combinations;
}

/**
 * Generate combinations of specified size using iterative approach with limits
 */
function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size > arr.length) return [];
  if (size === 1) return arr.map(item => [item]);
  
  const combinations: T[][] = [];
  const MAX_COMBINATIONS = 500; // Limit combinations per size
  
  function generateCombos(start: number, current: T[]) {
    if (combinations.length >= MAX_COMBINATIONS) {
      return; // Stop generating more combinations
    }
    
    if (current.length === size) {
      combinations.push([...current]);
      return;
    }
    
    for (let i = start; i <= arr.length - (size - current.length); i++) {
      if (combinations.length >= MAX_COMBINATIONS) {
        break;
      }
      current.push(arr[i]);
      generateCombos(i + 1, current);
      current.pop();
    }
  }
  
  generateCombos(0, []);
  return combinations;
}

/**
 * Analyze a combination of chunks to create a merge candidate
 */
function analyzeChunkCombination(
  chunks: OutputPath[],
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  metafile: Metafile,
  options: Required<CandidateDetectionOptions>
): MergeCandidate {
  const combinedSize = chunks.reduce((total, chunk) => {
    const info = sizeInfo.get(chunk);
    return total + (info?.rawSize || 0);
  }, 0);
  
  const combinedGzipSize = chunks.reduce((total, chunk) => {
    const info = sizeInfo.get(chunk);
    return total + (info?.estimatedGzipSize || 0);
  }, 0);
  
  // Analyze shared dependencies
  const sharedDependencyCount = calculateSharedDependencies(chunks, metafile);
  const dependencyDistance = calculateDependencyDistance(chunks, metafile);
  const loadTimingCorrelation = options.analyzeLoadTiming 
    ? calculateLoadTimingCorrelation(chunks, metafile)
    : 0.5;
  
  // Determine merge reason based on strongest factor
  let mergeReason: MergeCandidate['mergeReason'] = 'size-optimization';
  if (sharedDependencyCount >= options.minSharedDependencies) {
    mergeReason = 'shared-dependencies';
  } else if (dependencyDistance <= options.maxDependencyDistance) {
    mergeReason = 'geographic-proximity';
  } else if (loadTimingCorrelation > 0.7) {
    mergeReason = 'load-timing';
  }
  
  const priority = calculateMergePriority({
    chunks,
    combinedSize,
    combinedGzipSize,
    mergeReason,
    sharedDependencyCount,
    dependencyDistance,
    loadTimingCorrelation
  });
  
  return {
    chunks,
    combinedSize,
    combinedGzipSize,
    mergeReason,
    priority,
    sharedDependencyCount,
    dependencyDistance,
    loadTimingCorrelation
  };
}

/**
 * Calculate the number of shared dependencies between chunks
 */
function calculateSharedDependencies(chunks: OutputPath[], metafile: Metafile): number {
  if (chunks.length < 2) return 0;
  
  const chunkDependencies = chunks.map(chunk => {
    const outputInfo = metafile.outputs[chunk];
    if (!outputInfo?.imports) return new Set<string>();
    
    return new Set(
      outputInfo.imports
        .filter(imp => !imp.external && imp.kind !== 'dynamic-import')
        .map(imp => imp.path)
    );
  });
  
  if (chunkDependencies.length === 0) return 0;
  
  // Find intersection of all dependency sets
  const sharedDeps = chunkDependencies.reduce((shared, deps) => {
    return new Set([...shared].filter(dep => deps.has(dep)));
  });
  
  return sharedDeps.size;
}

/**
 * Calculate the dependency distance between chunks (average shortest path)
 */
function calculateDependencyDistance(chunks: OutputPath[], metafile: Metafile): number {
  if (chunks.length < 2) return 0;
  
  // Build dependency graph
  const graph = buildDependencyGraph(metafile);
  
  let totalDistance = 0;
  let pairCount = 0;
  
  // Calculate distance between all pairs of chunks
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const distance = findShortestPath(graph, chunks[i], chunks[j]);
      if (distance !== Infinity) {
        totalDistance += distance;
        pairCount++;
      }
    }
  }
  
  return pairCount > 0 ? totalDistance / pairCount : Infinity;
}

/**
 * Build dependency graph from metafile
 */
function buildDependencyGraph(metafile: Metafile): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  for (const [outputPath, outputInfo] of Object.entries(metafile.outputs)) {
    if (!outputInfo.imports) continue;
    
    const dependencies = new Set<string>();
    for (const imp of outputInfo.imports) {
      if (!imp.external && imp.kind !== 'dynamic-import') {
        dependencies.add(imp.path);
      }
    }
    
    graph.set(outputPath, dependencies);
  }
  
  return graph;
}

/**
 * Find shortest path between two nodes using BFS
 */
function findShortestPath(graph: Map<string, Set<string>>, start: string, end: string): number {
  if (start === end) return 0;
  
  const visited = new Set<string>();
  const queue: Array<{ node: string; distance: number }> = [{ node: start, distance: 0 }];
  
  while (queue.length > 0) {
    const { node, distance } = queue.shift()!;
    
    if (visited.has(node)) continue;
    visited.add(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (neighbor === end) {
        return distance + 1;
      }
      
      if (!visited.has(neighbor)) {
        queue.push({ node: neighbor, distance: distance + 1 });
      }
    }
  }
  
  return Infinity; // No path found
}

/**
 * Calculate load timing correlation (placeholder implementation)
 * In a real scenario, this would analyze usage patterns from analytics or routing data
 */
function calculateLoadTimingCorrelation(chunks: OutputPath[], metafile: Metafile): number {
  // Simplified heuristic: chunks with similar names or in similar paths are more likely to be loaded together
  if (chunks.length < 2) return 0;
  
  let correlationSum = 0;
  let pairCount = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const similarity = calculatePathSimilarity(chunks[i], chunks[j]);
      correlationSum += similarity;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? correlationSum / pairCount : 0;
}

/**
 * Calculate similarity between two file paths
 */
function calculatePathSimilarity(path1: string, path2: string): number {
  const parts1 = path1.split('/');
  const parts2 = path2.split('/');
  
  const commonParts = Math.min(parts1.length, parts2.length);
  let matchingParts = 0;
  
  for (let i = 0; i < commonParts; i++) {
    if (parts1[i] === parts2[i]) {
      matchingParts++;
    } else {
      break;
    }
  }
  
  return matchingParts / Math.max(parts1.length, parts2.length);
}

/**
 * Calculate merge priority score based on multiple factors
 * 
 * Scoring breakdown:
 * - Size efficiency: 0-40 points
 * - Shared dependencies: 0-30 points
 * - Geographic proximity: 0-20 points  
 * - Load timing correlation: 0-10 points
 */
export function calculateMergePriority(candidate: Omit<MergeCandidate, 'priority'>): number {
  let score = 0;
  
  // Base score for any merge (ensuring we get positive scores)
  score += 10;
  
  // Size efficiency (0-40 points) - favor ANY merging for smaller chunks
  if (candidate.combinedSize < 250000) { // Under 250KB gets full points
    score += 40;
  } else {
    score += 20; // Still give some points for larger merges
  }
  
  // Shared dependencies (0-30 points)
  score += Math.min(30, candidate.sharedDependencyCount * 10);
  
  // Geographic proximity (0-20 points) - lower distance is better
  const maxDistance = 10; // Increased max distance threshold
  if (candidate.dependencyDistance < maxDistance) {
    const proximityFactor = Math.max(0, (maxDistance - candidate.dependencyDistance) / maxDistance);
    score += proximityFactor * 20;
  } else {
    score += 5; // Still give some points for distant chunks
  }
  
  // Load timing correlation (0-10 points)
  score += candidate.loadTimingCorrelation * 10;
  
  // Bonus for having more chunks (encourages consolidation)
  score += (candidate.chunks.length - 2) * 5;
  
  const finalScore = Math.round(score);
  
  // Debug logging for priority calculation
  if (finalScore <= 0) {
    console.log(`❌ Zero priority for [${candidate.chunks.slice(0,2).join(', ')}]: size=${candidate.combinedSize}, shared=${candidate.sharedDependencyCount}, distance=${candidate.dependencyDistance}`);
  }
  
  return finalScore;
}

/**
 * Filter candidates to avoid conflicts with existing strategy
 */
export function filterConflictingCandidates(
  candidates: MergeCandidate[],
  currentStrategy: MergeStrategyMap
): MergeCandidate[] {
  const alreadyMerged = new Set<OutputPath>();
  
  // Track all chunks already in merge groups
  for (const chunkGroup of currentStrategy.values()) {
    for (const chunk of chunkGroup) {
      alreadyMerged.add(chunk);
    }
  }
  
  // Filter out candidates that would conflict with existing merges
  return candidates.filter(candidate => {
    return candidate.chunks.every(chunk => !alreadyMerged.has(chunk));
  });
}
