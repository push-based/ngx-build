import { Metafile } from 'esbuild';
import {
  calculateChunkSizes,
  calculateSizeSummary,
  validateCombinedSize,
  formatBytes,
  ChunkSizeInfo,
  SizeAnalysisOptions
} from './chunk-size-analyzer';

describe('ChunkSizeAnalyzer', () => {
  const mockMetafile: Metafile = {
    inputs: {},
    outputs: {
      'main.js': {
        bytes: 12000,
        imports: [{ path: 'chunk1.js', kind: 'import-statement', external: false }],
        inputs: { 'src/main.ts': { bytesInOutput: 12000 } },
        exports: []
      },
      'chunk1.js': {
        bytes: 5000, // Small chunk, eligible for merging
        imports: [],
        inputs: { 'src/utils.ts': { bytesInOutput: 5000 } },
        exports: []
      },
      'chunk2.js': {
        bytes: 3000, // Small chunk, eligible for merging
        imports: [],
        inputs: { 'src/helpers.ts': { bytesInOutput: 3000 } },
        exports: []
      },
      'chunk3.js': {
        bytes: 15000, // Large chunk, not eligible
        imports: [],
        inputs: { 'src/large-feature.ts': { bytesInOutput: 15000 } },
        exports: []
      },
      'styles.css': {
        bytes: 2000, // CSS, should be ignored
        inputs: { 'src/styles.css': { bytesInOutput: 2000 } }
      }
    }
  };

  describe('calculateChunkSizes', () => {
    it('should calculate size info for JS chunks only', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      
      expect(sizeInfo.size).toBe(4); // Only JS files
      expect(sizeInfo.has('styles.css')).toBe(false);
    });

    it('should mark small chunks as eligible', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      
      const chunk1Info = sizeInfo.get('chunk1.js')!;
      const chunk2Info = sizeInfo.get('chunk2.js')!;
      const chunk3Info = sizeInfo.get('chunk3.js')!;
      const mainInfo = sizeInfo.get('main.js')!;

      expect(chunk1Info.isEligible).toBe(true);
      expect(chunk2Info.isEligible).toBe(true);
      expect(chunk3Info.isEligible).toBe(false); // Over 8kb threshold
      expect(mainInfo.isEligible).toBe(false); // Over 8kb threshold
    });

    it('should calculate estimated gzip size', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const chunk1Info = sizeInfo.get('chunk1.js')!;
      
      expect(chunk1Info.estimatedGzipSize).toBe(1500); // 30% of 5000
    });

    it('should respect custom size threshold', () => {
      const options: SizeAnalysisOptions = { sizeThreshold: 4000 };
      const sizeInfo = calculateChunkSizes(mockMetafile, options);
      
      const chunk1Info = sizeInfo.get('chunk1.js')!;
      const chunk2Info = sizeInfo.get('chunk2.js')!;
      
      expect(chunk1Info.isEligible).toBe(false); // 5000 > 4000
      expect(chunk2Info.isEligible).toBe(true);  // 3000 < 4000
    });

    it('should respect custom gzip ratio', () => {
      const options: SizeAnalysisOptions = { gzipRatio: 0.4 };
      const sizeInfo = calculateChunkSizes(mockMetafile, options);
      
      const chunk1Info = sizeInfo.get('chunk1.js')!;
      expect(chunk1Info.estimatedGzipSize).toBe(2000); // 40% of 5000
    });
  });

  describe('calculateSizeSummary', () => {
    it('should calculate correct summary statistics', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const summary = calculateSizeSummary(sizeInfo);
      
      expect(summary.totalChunks).toBe(4);
      expect(summary.eligibleChunks).toBe(2); // chunk1.js and chunk2.js
      expect(summary.totalSize).toBe(35000); // 12000 + 5000 + 3000 + 15000
      expect(summary.averageSize).toBe(8750); // 35000 / 4
      expect(summary.smallChunksSize).toBe(8000); // 5000 + 3000
    });

    it('should calculate median size correctly', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const summary = calculateSizeSummary(sizeInfo);
      
      // Sorted sizes: [3000, 5000, 12000, 15000]
      // Median of 4 items: (5000 + 12000) / 2 = 8500
      expect(summary.medianSize).toBe(8500);
    });

    it('should handle empty size info', () => {
      const emptySizeInfo = new Map<string, ChunkSizeInfo>();
      const summary = calculateSizeSummary(emptySizeInfo);
      
      expect(summary.totalChunks).toBe(0);
      expect(summary.eligibleChunks).toBe(0);
      expect(summary.totalSize).toBe(0);
      expect(summary.averageSize).toBe(0);
      expect(summary.medianSize).toBe(0);
      expect(summary.smallChunksSize).toBe(0);
    });
  });

  describe('validateCombinedSize', () => {
    it('should validate chunks within size limit', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const chunkPaths = ['chunk1.js', 'chunk2.js']; // 5000 + 3000 = 8000
      
      const isValid = validateCombinedSize(chunkPaths, sizeInfo, 10000);
      expect(isValid).toBe(true);
    });

    it('should reject chunks exceeding size limit', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const chunkPaths = ['chunk1.js', 'chunk2.js']; // 5000 + 3000 = 8000
      
      const isValid = validateCombinedSize(chunkPaths, sizeInfo, 7000);
      expect(isValid).toBe(false);
    });

    it('should handle unknown chunks gracefully', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const chunkPaths = ['chunk1.js', 'unknown-chunk.js'];
      
      // Should only count known chunks (chunk1.js = 5000)
      const isValid = validateCombinedSize(chunkPaths, sizeInfo, 6000);
      expect(isValid).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });
});

