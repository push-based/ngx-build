import { Metafile } from 'esbuild';
import {
  detectMergeCandidates,
  calculateMergePriority,
  filterConflictingCandidates,
  MergeCandidate
} from './merge-candidate-detector';
import { calculateChunkSizes } from './chunk-size-analyzer';
import { MergeStrategyMap } from './merge-strategy-v2';

describe('MergeCandidateDetector', () => {
  const mockMetafile: Metafile = {
    inputs: {},
    outputs: {
      'main.js': {
        bytes: 12000,
        imports: [
          { path: 'shared.js', kind: 'import-statement', external: false },
          { path: 'chunk1.js', kind: 'dynamic-import', external: false }
        ],
        inputs: { 'src/main.ts': { bytesInOutput: 12000 } },
        exports: []
      },
      'shared.js': {
        bytes: 2000, // Small chunk with shared dependencies
        imports: [{ path: 'utils.js', kind: 'import-statement', external: false }],
        inputs: { 'src/shared.ts': { bytesInOutput: 2000 } },
        exports: []
      },
      'utils.js': {
        bytes: 1000, // Very small utility chunk
        imports: [],
        inputs: { 'src/utils.ts': { bytesInOutput: 1000 } },
        exports: []
      },
      'chunk1.js': {
        bytes: 5000, // Medium chunk
        imports: [
          { path: 'shared.js', kind: 'import-statement', external: false },
          { path: 'utils.js', kind: 'import-statement', external: false }
        ],
        inputs: { 'src/feature1.ts': { bytesInOutput: 5000 } },
        exports: []
      },
      'chunk2.js': {
        bytes: 3000, // Small chunk
        imports: [{ path: 'shared.js', kind: 'import-statement', external: false }],
        inputs: { 'src/feature2.ts': { bytesInOutput: 3000 } },
        exports: []
      },
      'chunk3.js': {
        bytes: 4000, // Small chunk with different dependencies
        imports: [],
        inputs: { 'src/feature3.ts': { bytesInOutput: 4000 } },
        exports: []
      },
      'large.js': {
        bytes: 15000, // Large chunk, not eligible
        imports: [],
        inputs: { 'src/large-feature.ts': { bytesInOutput: 15000 } },
        exports: []
      }
    }
  };

  const emptyStrategy: MergeStrategyMap = new Map();

  describe('detectMergeCandidates', () => {
    it('should detect candidates from eligible small chunks', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const candidates = detectMergeCandidates(sizeInfo, emptyStrategy, mockMetafile);
      
      expect(candidates.length).toBeGreaterThan(0);
      
      // All candidates should only contain eligible chunks
      for (const candidate of candidates) {
        for (const chunk of candidate.chunks) {
          const info = sizeInfo.get(chunk)!;
          expect(info.isEligible).toBe(true);
        }
      }
    });

    it('should prioritize candidates with shared dependencies', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const candidates = detectMergeCandidates(sizeInfo, emptyStrategy, mockMetafile);
      
      // Find candidates with shared dependencies
      const sharedDepsCandidate = candidates.find(c => 
        c.chunks.includes('chunk1.js') && c.chunks.includes('chunk2.js')
      );
      
      const noSharedDepsCandidate = candidates.find(c => 
        c.chunks.includes('chunk2.js') && c.chunks.includes('chunk3.js')
      );
      
      if (sharedDepsCandidate && noSharedDepsCandidate) {
        expect(sharedDepsCandidate.sharedDependencyCount).toBeGreaterThan(0);
        expect(noSharedDepsCandidate.sharedDependencyCount).toBe(0);
        expect(sharedDepsCandidate.priority).toBeGreaterThan(noSharedDepsCandidate.priority);
      }
    });

    it('should sort candidates by priority', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const candidates = detectMergeCandidates(sizeInfo, emptyStrategy, mockMetafile);
      
      for (let i = 0; i < candidates.length - 1; i++) {
        expect(candidates[i].priority).toBeGreaterThanOrEqual(candidates[i + 1].priority);
      }
    });

    it('should respect maxChunksPerMerge option', () => {
      const sizeInfo = calculateChunkSizes(mockMetafile);
      const candidates = detectMergeCandidates(sizeInfo, emptyStrategy, mockMetafile, {
        maxChunksPerMerge: 2
      });
      
      for (const candidate of candidates) {
        expect(candidate.chunks.length).toBeLessThanOrEqual(2);
      }
    });

    it('should return empty array when no eligible chunks exist', () => {
      const metafileWithLargeChunks: Metafile = {
        inputs: {},
        outputs: {
          'large1.js': {
            bytes: 15000, // Too large
            imports: [],
            inputs: { 'src/large1.ts': { bytesInOutput: 15000 } },
            exports: []
          },
          'large2.js': {
            bytes: 20000, // Too large
            imports: [],
            inputs: { 'src/large2.ts': { bytesInOutput: 20000 } },
            exports: []
          }
        }
      };
      
      const sizeInfo = calculateChunkSizes(metafileWithLargeChunks);
      const candidates = detectMergeCandidates(sizeInfo, emptyStrategy, metafileWithLargeChunks);
      
      expect(candidates).toEqual([]);
    });
  });

  describe('calculateMergePriority', () => {
    it('should calculate priority based on multiple factors', () => {
      const mockCandidate: Omit<MergeCandidate, 'priority'> = {
        chunks: ['chunk1.js', 'chunk2.js'],
        combinedSize: 6000,
        combinedGzipSize: 1800,
        mergeReason: 'shared-dependencies',
        sharedDependencyCount: 2,
        dependencyDistance: 1,
        loadTimingCorrelation: 0.8
      };
      
      const priority = calculateMergePriority(mockCandidate);
      
      expect(priority).toBeGreaterThan(0);
      expect(priority).toBeLessThanOrEqual(100); // Max possible score
    });

    it('should give higher priority to smaller combined sizes', () => {
      const smallCandidate: Omit<MergeCandidate, 'priority'> = {
        chunks: ['utils.js', 'shared.js'],
        combinedSize: 3000,
        combinedGzipSize: 900,
        mergeReason: 'size-optimization',
        sharedDependencyCount: 0,
        dependencyDistance: 2,
        loadTimingCorrelation: 0.5
      };
      
      const largeCandidate: Omit<MergeCandidate, 'priority'> = {
        chunks: ['chunk1.js', 'chunk2.js'],
        combinedSize: 8000,
        combinedGzipSize: 2400,
        mergeReason: 'size-optimization',
        sharedDependencyCount: 0,
        dependencyDistance: 2,
        loadTimingCorrelation: 0.5
      };
      
      const smallPriority = calculateMergePriority(smallCandidate);
      const largePriority = calculateMergePriority(largeCandidate);
      
      expect(smallPriority).toBeGreaterThan(largePriority);
    });

    it('should give higher priority to shared dependencies', () => {
      const sharedDepsCandidate: Omit<MergeCandidate, 'priority'> = {
        chunks: ['chunk1.js', 'chunk2.js'],
        combinedSize: 6000,
        combinedGzipSize: 1800,
        mergeReason: 'shared-dependencies',
        sharedDependencyCount: 3,
        dependencyDistance: 2,
        loadTimingCorrelation: 0.5
      };
      
      const noSharedDepsCandidate: Omit<MergeCandidate, 'priority'> = {
        chunks: ['chunk2.js', 'chunk3.js'],
        combinedSize: 6000,
        combinedGzipSize: 1800,
        mergeReason: 'size-optimization',
        sharedDependencyCount: 0,
        dependencyDistance: 2,
        loadTimingCorrelation: 0.5
      };
      
      const sharedDepsPriority = calculateMergePriority(sharedDepsCandidate);
      const noSharedDepsPriority = calculateMergePriority(noSharedDepsCandidate);
      
      expect(sharedDepsPriority).toBeGreaterThan(noSharedDepsPriority);
    });
  });

  describe('filterConflictingCandidates', () => {
    it('should filter out candidates that conflict with existing strategy', () => {
      const existingStrategy: MergeStrategyMap = new Map([
        ['merged-group-1', ['chunk1.js', 'chunk2.js']]
      ]);
      
      const candidates: MergeCandidate[] = [
        {
          chunks: ['chunk1.js', 'chunk3.js'], // Conflicts with existing strategy
          combinedSize: 9000,
          combinedGzipSize: 2700,
          mergeReason: 'size-optimization',
          priority: 50,
          sharedDependencyCount: 0,
          dependencyDistance: 2,
          loadTimingCorrelation: 0.5
        },
        {
          chunks: ['shared.js', 'utils.js'], // No conflict
          combinedSize: 3000,
          combinedGzipSize: 900,
          mergeReason: 'size-optimization',
          priority: 60,
          sharedDependencyCount: 1,
          dependencyDistance: 1,
          loadTimingCorrelation: 0.6
        }
      ];
      
      const filteredCandidates = filterConflictingCandidates(candidates, existingStrategy);
      
      expect(filteredCandidates).toHaveLength(1);
      expect(filteredCandidates[0].chunks).toEqual(['shared.js', 'utils.js']);
    });

    it('should return all candidates when no conflicts exist', () => {
      const emptyStrategy: MergeStrategyMap = new Map();
      
      const candidates: MergeCandidate[] = [
        {
          chunks: ['chunk1.js', 'chunk2.js'],
          combinedSize: 8000,
          combinedGzipSize: 2400,
          mergeReason: 'shared-dependencies',
          priority: 70,
          sharedDependencyCount: 2,
          dependencyDistance: 1,
          loadTimingCorrelation: 0.7
        },
        {
          chunks: ['shared.js', 'utils.js'],
          combinedSize: 3000,
          combinedGzipSize: 900,
          mergeReason: 'size-optimization',
          priority: 60,
          sharedDependencyCount: 1,
          dependencyDistance: 1,
          loadTimingCorrelation: 0.6
        }
      ];
      
      const filteredCandidates = filterConflictingCandidates(candidates, emptyStrategy);
      
      expect(filteredCandidates).toHaveLength(2);
      expect(filteredCandidates).toEqual(candidates);
    });
  });
});

