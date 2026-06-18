import { Plugin } from 'esbuild';
import { mergeStrategy } from '../core';
import { getAppEntryPoint } from './esbuild.utils';
import { rolldownToEsbuildOutputs } from './rolldown/bundle-adaptor.utils';
import { rolldownReBundle } from './rolldown/rolldown.utils';

export default function optimizeChunksPlugin(
  options: { main?: string; maxChunks?: number } = {}
): Plugin {
  return {
    name: 'optimize-bundle',
    setup({ onEnd, initialOptions }) {
      onEnd(async (result) => {
        if (initialOptions.define?.['ngDevMode'] !== 'false') {
          return; // Bail out of optimization on dev build or serve
        }
        if (!result.metafile) {
          throw new Error('Unable to extract metafile from esbuild plugin');
        }
        if (!result.outputFiles) {
          throw new Error('Unable to extract outputFiles in esbuild plugin');
        }

        const entryChunk = getAppEntryPoint(initialOptions, result.metafile);
        const strategy = mergeStrategy(entryChunk, result.metafile);
        const reBundledOutput = await rolldownReBundle(
          entryChunk,
          result.outputFiles,
          initialOptions,
          strategy
        );
        const { newMetafileOutputs, newOutputFiles } = rolldownToEsbuildOutputs(
          reBundledOutput,
          result.metafile
        );

        result.metafile.outputs = newMetafileOutputs;
        result.outputFiles = newOutputFiles;
      });
    },
  };
}
