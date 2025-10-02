import { Metafile } from 'esbuild';
import { OutputPath } from './merge-strategy-v2';

/**
 * Information about a chunk's size characteristics for merge analysis
 */
export interface ChunkSizeInfo {
  /** The output path of the chunk */
  path: OutputPath;
  /** Raw file size in bytes from esbuild metafile */
  rawSize: number;
  /** Estimated compressed (gzip) size in bytes */
  estimatedGzipSize: number;
  /** Whether this chunk is under the size threshold and eligible for merging */
  isEligible: boolean;
}

/**
 * Configuration options for size-based chunk analysis
 */
export interface SizeAnalysisOptions {
  /** Size threshold in bytes below which chunks are eligible for merging (default: 8192 = 8kb) */
  sizeThreshold?: number;
  /** Gzip compression ratio estimate for size calculations (default: 0.3 = 30%) */
  gzipRatio?: number;
  /** Maximum combined size in bytes to prevent oversized merged chunks (default: 32768 = 32kb) */
  maxCombinedSize?: number;
}

const DEFAULT_SIZE_OPTIONS: Required<SizeAnalysisOptions> = {
  sizeThreshold: 8192, // 8kb
  gzipRatio: 0.3, // 30% compression
  maxCombinedSize: 32768, // 32kb
};

/**
 * Calculate size information for all chunks in the metafile
 * 
 * Uses esbuild's metafile `outputs[path].bytes` property for accurate size calculation
 * and applies gzip estimation using compression ratio heuristics.
 * 
 * @param metafile - The esbuild metafile containing build output information
 * @param options - Configuration options for size analysis
 * @returns Map of output paths to their size information
 */
export function calculateChunkSizes(
  metafile: Metafile,
  options: SizeAnalysisOptions = {}
): Map<OutputPath, ChunkSizeInfo> {
  const opts = { ...DEFAULT_SIZE_OPTIONS, ...options };
  const sizeMap = new Map<OutputPath, ChunkSizeInfo>();
  
  const outputs = metafile.outputs;
  
  for (const [outputPath, outputInfo] of Object.entries(outputs)) {
    // Only analyze JavaScript chunks (skip assets, CSS, etc.)
    if (!isJavaScriptChunk(outputPath, outputInfo)) {
      continue;
    }
    
    const rawSize = outputInfo.bytes || 0;
    const estimatedGzipSize = Math.round(rawSize * opts.gzipRatio);
    const isEligible = rawSize > 0 && rawSize < opts.sizeThreshold;
    
    sizeMap.set(outputPath, {
      path: outputPath,
      rawSize,
      estimatedGzipSize,
      isEligible
    });
  }
  
  return sizeMap;
}

/**
 * Get summary statistics about chunk sizes for analysis and monitoring
 */
export interface SizeSummary {
  totalChunks: number;
  eligibleChunks: number;
  totalSize: number;
  averageSize: number;
  medianSize: number;
  smallChunksSize: number; // Total size of eligible chunks
}

/**
 * Calculate summary statistics for chunk sizes
 * 
 * @param sizeInfo - Map of chunk size information
 * @returns Summary statistics
 */
export function calculateSizeSummary(sizeInfo: Map<OutputPath, ChunkSizeInfo>): SizeSummary {
  const allSizes = Array.from(sizeInfo.values());
  const eligibleChunks = allSizes.filter(info => info.isEligible);
  
  const totalChunks = allSizes.length;
  const totalSize = allSizes.reduce((sum, info) => sum + info.rawSize, 0);
  const averageSize = totalChunks > 0 ? totalSize / totalChunks : 0;
  
  // Calculate median
  const sortedSizes = allSizes.map(info => info.rawSize).sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedSizes.length / 2);
  const medianSize = sortedSizes.length > 0 
    ? (sortedSizes.length % 2 === 0 
        ? (sortedSizes[medianIndex - 1] + sortedSizes[medianIndex]) / 2
        : sortedSizes[medianIndex])
    : 0;
  
  const smallChunksSize = eligibleChunks.reduce((sum, info) => sum + info.rawSize, 0);
  
  return {
    totalChunks,
    eligibleChunks: eligibleChunks.length,
    totalSize,
    averageSize: Math.round(averageSize),
    medianSize: Math.round(medianSize),
    smallChunksSize
  };
}

/**
 * Helper to determine if an output is a JavaScript chunk suitable for size analysis
 */
function isJavaScriptChunk(path: string, outputInfo: Metafile['outputs'][string]): boolean {
  return path.endsWith('.js') && !!outputInfo.imports;
}

/**
 * Validate that combining chunks won't exceed size constraints
 * 
 * @param chunkPaths - Array of chunk paths to potentially combine
 * @param sizeInfo - Map of chunk size information
 * @param maxCombinedSize - Maximum allowed combined size
 * @returns Whether the combination is within size limits
 */
export function validateCombinedSize(
  chunkPaths: OutputPath[],
  sizeInfo: Map<OutputPath, ChunkSizeInfo>,
  maxCombinedSize: number
): boolean {
  const combinedSize = chunkPaths.reduce((total, path) => {
    const info = sizeInfo.get(path);
    return total + (info?.rawSize || 0);
  }, 0);
  
  return combinedSize <= maxCombinedSize;
}

/**
 * Format bytes to human-readable string for logging and analysis
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

