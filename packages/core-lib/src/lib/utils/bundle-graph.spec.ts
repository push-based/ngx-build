import { describe, expect, it } from 'vitest';
import { loadStatsFile } from '../../../test/utils';
import { 
  generateBundleGraph, 
  getReachableVertices, 
  getReachableVerticesFromImportStatements,
  findEntryPointOutput,
  type ModuleGraph
} from './bundle-graph';
import type { Metafile } from 'esbuild';

describe('bundle-graph', () => {
  describe('integration tests with real data', () => {
    const hostAppMetafile = loadStatsFile('./test/mocks/stats.json');

    it('should simplify the module graph', () => {
      const graph = generateBundleGraph('main-WTKNYPAX.js', hostAppMetafile);

      expect(graph).toBeDefined();
      expect(Object.keys(graph).length).toBeGreaterThan(0);
    });
  });

  describe('generateBundleGraph', () => {
    it('should create a simple module graph with static imports only', () => {
      const mockMetafile: Metafile = {
        inputs: {},
        outputs: {
          'main.js': {
            imports: [
              { path: 'chunk-a.js', kind: 'import-statement' },
              { path: 'chunk-b.js', kind: 'import-statement' }
            ],
            exports: [],
            entryPoint: 'src/main.ts',
            inputs: {},
            bytes: 1000
          },
          'chunk-a.js': {
            imports: [
              { path: 'chunk-c.js', kind: 'import-statement' }
            ],
            exports: [],
            inputs: {},
            bytes: 500
          },
          'chunk-b.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 300
          },
          'chunk-c.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 200
          }
        }
      };

      const result = generateBundleGraph('main.js', mockMetafile);

      const expected: ModuleGraph = {
        'main.js': {
          entryPoint: true,
          imports: [
            { path: 'chunk-a.js', kind: 'import-statement' },
            { path: 'chunk-b.js', kind: 'import-statement' }
          ]
        },
        'chunk-a.js': {
          entryPoint: false,
          imports: [
            { path: 'chunk-c.js', kind: 'import-statement' }
          ]
        },
        'chunk-b.js': {
          entryPoint: false,
          imports: []
        },
        'chunk-c.js': {
          entryPoint: false,
          imports: []
        }
      };

      expect(result).toEqual(expected);
    });

    it('should handle dynamic imports alongside static imports', () => {
      const mockMetafile: Metafile = {
        inputs: {},
        outputs: {
          'main.js': {
            imports: [
              { path: 'chunk-static.js', kind: 'import-statement' },
              { path: 'chunk-dynamic.js', kind: 'dynamic-import' }
            ],
            exports: [],
            entryPoint: 'src/main.ts',
            inputs: {},
            bytes: 1000
          },
          'chunk-static.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 300
          },
          'chunk-dynamic.js': {
            imports: [
              { path: 'chunk-nested.js', kind: 'import-statement' }
            ],
            exports: [],
            inputs: {},
            bytes: 400
          },
          'chunk-nested.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 200
          }
        }
      };

      const result = generateBundleGraph('main.js', mockMetafile);

      expect(result['main.js'].imports).toEqual([
        { path: 'chunk-static.js', kind: 'import-statement' },
        { path: 'chunk-dynamic.js', kind: 'dynamic-import' }
      ]);
      expect(result['chunk-dynamic.js'].imports).toEqual([
        { path: 'chunk-nested.js', kind: 'import-statement' }
      ]);
      expect(Object.keys(result)).toHaveLength(4);
    });

    it('should filter out non-relevant import kinds', () => {
      const mockMetafile: Metafile = {
        inputs: {},
        outputs: {
          'main.js': {
            imports: [
              { path: 'chunk-a.js', kind: 'import-statement' },
              { path: 'chunk-b.js', kind: 'dynamic-import' },
              { path: 'styles.css', kind: 'require-call' as any },
              { path: 'external-lib', kind: 'require-resolve' as any }
            ],
            exports: [],
            entryPoint: 'src/main.ts',
            inputs: {},
            bytes: 1000
          },
          'chunk-a.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 300
          },
          'chunk-b.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 400
          },
          'styles.css': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 100
          },
          'external-lib': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 50
          }
        }
      };

      const result = generateBundleGraph('main.js', mockMetafile);

      // The function should only include imports with 'import-statement' or 'dynamic-import' kinds
      expect(result['main.js'].imports).toEqual([
        { path: 'chunk-a.js', kind: 'import-statement' },
        { path: 'chunk-b.js', kind: 'dynamic-import' }
      ]);
      // But it includes all reachable vertices (even with filtered import kinds)
      // because getReachableVertices doesn't filter by import kind
      expect(Object.keys(result)).toHaveLength(5);
      expect(result).toHaveProperty('styles.css');
      expect(result).toHaveProperty('external-lib');
      // However, these chunks should have empty imports since their kind was filtered
      expect(result['styles.css'].imports).toEqual([]);
      expect(result['external-lib'].imports).toEqual([]);
    });

    it('should handle duplicate imports by deduplicating them', () => {
      const mockMetafile: Metafile = {
        inputs: {},
        outputs: {
          'main.js': {
            imports: [
              { path: 'chunk-a.js', kind: 'import-statement' },
              { path: 'chunk-a.js', kind: 'import-statement' }, // duplicate
              { path: 'chunk-b.js', kind: 'dynamic-import' }
            ],
            exports: [],
            entryPoint: 'src/main.ts',
            inputs: {},
            bytes: 1000
          },
          'chunk-a.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 300
          },
          'chunk-b.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 400
          }
        }
      };

      const result = generateBundleGraph('main.js', mockMetafile);

      expect(result['main.js'].imports).toEqual([
        { path: 'chunk-a.js', kind: 'import-statement' },
        { path: 'chunk-b.js', kind: 'dynamic-import' }
      ]);
    });

    it('should throw error for mixed import kinds of same chunk', () => {
      const mockMetafile: Metafile = {
        inputs: {},
        outputs: {
          'main.js': {
            imports: [
              { path: 'chunk-a.js', kind: 'import-statement' },
              { path: 'chunk-a.js', kind: 'dynamic-import' } // conflicting kind
            ],
            exports: [],
            entryPoint: 'src/main.ts',
            inputs: {},
            bytes: 1000
          },
          'chunk-a.js': {
            imports: [],
            exports: [],
            inputs: {},
            bytes: 300
          }
        }
      };

      expect(() => {
        generateBundleGraph('main.js', mockMetafile);
      }).toThrow(/metafile outputs for main\.js show it importing chunk-a\.js both as .* and .*/);
    });
  });

  describe('getReachableVertices', () => {
    const mockOutputs: Metafile['outputs'] = {
      'main.js': {
        imports: [
          { path: 'chunk-a.js', kind: 'import-statement' },
          { path: 'chunk-b.js', kind: 'dynamic-import' }
        ],
        exports: [],
        inputs: {},
        bytes: 1000
      },
      'chunk-a.js': {
        imports: [
          { path: 'chunk-c.js', kind: 'import-statement' }
        ],
        exports: [],
        inputs: {},
        bytes: 500
      },
      'chunk-b.js': {
        imports: [
          { path: 'chunk-d.js', kind: 'import-statement' }
        ],
        exports: [],
        inputs: {},
        bytes: 300
      },
      'chunk-c.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 200
      },
      'chunk-d.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 150
      },
      'isolated-chunk.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 100
      }
    };

    it('should return all reachable vertices from entry point', () => {
      const result = getReachableVertices('main.js', mockOutputs);
      
      expect(result).toContain('main.js');
      expect(result).toContain('chunk-a.js');
      expect(result).toContain('chunk-b.js');
      expect(result).toContain('chunk-c.js');
      expect(result).toContain('chunk-d.js');
      expect(result).not.toContain('isolated-chunk.js');
      expect(result).toHaveLength(5);
    });

    it('should handle circular dependencies', () => {
      const circularOutputs: Metafile['outputs'] = {
        'main.js': {
          imports: [{ path: 'chunk-a.js', kind: 'import-statement' }],
          exports: [], inputs: {}, bytes: 1000
        },
        'chunk-a.js': {
          imports: [{ path: 'chunk-b.js', kind: 'import-statement' }],
          exports: [], inputs: {}, bytes: 500
        },
        'chunk-b.js': {
          imports: [{ path: 'chunk-a.js', kind: 'import-statement' }], // circular
          exports: [], inputs: {}, bytes: 300
        }
      };

      const result = getReachableVertices('main.js', circularOutputs);
      
      expect(result).toContain('main.js');
      expect(result).toContain('chunk-a.js');
      expect(result).toContain('chunk-b.js');
      expect(result).toHaveLength(3);
    });

    it('should respect exclusion function', () => {
      const exclusionFn = (imp: any) => imp.kind === 'dynamic-import';
      const result = getReachableVertices('main.js', mockOutputs, exclusionFn);
      
      expect(result).toContain('main.js');
      expect(result).toContain('chunk-a.js');
      expect(result).toContain('chunk-c.js');
      expect(result).not.toContain('chunk-b.js');
      expect(result).not.toContain('chunk-d.js');
      expect(result).toHaveLength(3);
    });

    it('should handle missing entry point', () => {
      const result = getReachableVertices('non-existent.js', mockOutputs);
      
      expect(result).toEqual(['non-existent.js']);
    });
  });

  describe('getReachableVerticesFromImportStatements', () => {
    const mockOutputs: Metafile['outputs'] = {
      'main.js': {
        imports: [
          { path: 'chunk-static.js', kind: 'import-statement' },
          { path: 'chunk-dynamic.js', kind: 'dynamic-import' }
        ],
        exports: [],
        inputs: {},
        bytes: 1000
      },
      'chunk-static.js': {
        imports: [
          { path: 'chunk-nested-static.js', kind: 'import-statement' }
        ],
        exports: [],
        inputs: {},
        bytes: 500
      },
      'chunk-dynamic.js': {
        imports: [
          { path: 'chunk-nested-dynamic.js', kind: 'import-statement' }
        ],
        exports: [],
        inputs: {},
        bytes: 300
      },
      'chunk-nested-static.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 200
      },
      'chunk-nested-dynamic.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 150
      }
    };

    it('should only follow static import statements', () => {
      const result = getReachableVerticesFromImportStatements('main.js', mockOutputs);
      
      expect(result).toContain('main.js');
      expect(result).toContain('chunk-static.js');
      expect(result).toContain('chunk-nested-static.js');
      expect(result).not.toContain('chunk-dynamic.js');
      expect(result).not.toContain('chunk-nested-dynamic.js');
      expect(result).toHaveLength(3);
    });

    it('should handle entry point with only dynamic imports', () => {
      const dynamicOnlyOutputs: Metafile['outputs'] = {
        'main.js': {
          imports: [
            { path: 'chunk-dynamic.js', kind: 'dynamic-import' }
          ],
          exports: [],
          inputs: {},
          bytes: 1000
        },
        'chunk-dynamic.js': {
          imports: [],
          exports: [],
          inputs: {},
          bytes: 300
        }
      };

      const result = getReachableVerticesFromImportStatements('main.js', dynamicOnlyOutputs);
      
      expect(result).toEqual(['main.js']);
    });
  });

  describe('findEntryPointOutput', () => {
    const mockOutputs: Metafile['outputs'] = {
      'main-ABC123.js': {
        imports: [],
        exports: [],
        entryPoint: 'src/main.ts',
        inputs: {},
        bytes: 1000
      },
      'feature-DEF456.js': {
        imports: [],
        exports: [],
        entryPoint: 'src/feature/index.ts',
        inputs: {},
        bytes: 800
      },
      'chunk-GHI789.js': {
        imports: [],
        exports: [],
        inputs: {},
        bytes: 600
      }
    };

    it('should find output key by entry point path', () => {
      const result = findEntryPointOutput('src/main.ts', mockOutputs);
      expect(result).toBe('main-ABC123.js');
    });

    it('should find output key for feature entry point', () => {
      const result = findEntryPointOutput('src/feature/index.ts', mockOutputs);
      expect(result).toBe('feature-DEF456.js');
    });

    it('should return undefined for non-existent entry point', () => {
      const result = findEntryPointOutput('src/non-existent.ts', mockOutputs);
      expect(result).toBeUndefined();
    });

    it('should return undefined for chunk without entry point', () => {
      const result = findEntryPointOutput('chunk-GHI789.js', mockOutputs);
      expect(result).toBeUndefined();
    });
  });
});
