import type { Metafile } from 'esbuild';

import { mergeStrategyFactory, STRATEGY_TYPE } from './index';

describe('mergeStrategyFactory', () => {
  it('applies the default reachability strategy', () => {
    const metafile = createMetafile({
      'dist/main.js': output({
        entryPoint: 'src/main.ts',
        imports: [
          importStatement('dist/shared.js'),
          dynamicImport('dist/feature.js'),
        ],
      }),
      'dist/shared.js': output(),
      'dist/feature.js': output({
        entryPoint: 'src/feature.ts',
        imports: [importStatement('dist/feature-dep.js')],
      }),
      'dist/feature-dep.js': output(),
      'dist/styles.css': output(),
    });

    expect(toEntries(mergeStrategyFactory('dist/main.js', metafile))).toEqual([
      ['dist/main.js', ['dist/main.js', 'dist/shared.js']],
      ['dist/feature.js', ['dist/feature.js', 'dist/feature-dep.js']],
    ]);
  });

  it('applies a static closure strategy and keeps remaining chunks standalone', () => {
    const metafile = createMetafile({
      'dist/main.js': output({
        entryPoint: 'src/main.ts',
        imports: [
          importStatement('dist/shared.js'),
          dynamicImport('dist/feature.js'),
        ],
      }),
      'dist/shared.js': output(),
      'dist/feature.js': output({
        entryPoint: 'src/feature.ts',
        imports: [importStatement('dist/feature-dep.js')],
      }),
      'dist/feature-dep.js': output(),
    });

    expect(
      toEntries(
        mergeStrategyFactory('dist/main.js', metafile, {
          name: 'feature',
          strategies: [
            {
              label: 'feature closure',
              type: STRATEGY_TYPE.STATIC_CLOSURE,
              entryPoint: 'src/feature.ts',
            },
          ],
        })
      )
    ).toEqual([
      ['dist/feature.js', ['dist/feature.js', 'dist/feature-dep.js']],
      ['dist/main.js', ['dist/main.js']],
      ['dist/shared.js', ['dist/shared.js']],
    ]);
  });
});

function createMetafile(outputs: Metafile['outputs']): Metafile {
  return {
    inputs: {},
    outputs,
  };
}

function output(options: Partial<Metafile['outputs'][string]> = {}) {
  return {
    imports: [],
    exports: [],
    inputs: {},
    bytes: 1,
    ...options,
  } satisfies Metafile['outputs'][string];
}

function importStatement(path: string) {
  return {
    path,
    kind: 'import-statement',
  } satisfies Metafile['outputs'][string]['imports'][number];
}

function dynamicImport(path: string) {
  return {
    path,
    kind: 'dynamic-import',
  } satisfies Metafile['outputs'][string]['imports'][number];
}

function toEntries(strategy: Map<string, string[]>): [string, string[]][] {
  return [...strategy.entries()];
}
