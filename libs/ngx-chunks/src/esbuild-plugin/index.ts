/* eslint-disable no-param-reassign */
import type { Plugin } from 'esbuild';

import { mergeStrategyFactory, type MergeStrategyConfig } from '../core';
import { rolldownOutputsToEsbuildOutputs } from './rolldown/to-esbuild-outputs';
import { rolldownRebundle } from './rolldown/rebundle';
import { esbuildOutputLoaderPlugin } from './rolldown/esbuild-output-loader.plugin';
import { getAppEntryPoint, isJavaScriptOutputFile } from './utils/esbuild';
import { initialChunks } from './utils/initial-chunks';

export interface NgxChunksPluginOptions {
  mergeStrategy?: MergeStrategyConfig;
}

export default function optimizeChunksPlugin(
  options: NgxChunksPluginOptions = {}
): Plugin {
  return {
    name: 'ngx-chunks',
    setup({ onEnd, initialOptions }) {
      onEnd(async (result) => {
        if (initialOptions.platform === 'node') {
          return;
        }

        if (!result.metafile) {
          throw new Error('Unable to extract metafile from esbuild result.');
        }

        if (!result.outputFiles) {
          throw new Error('Unable to extract outputFiles from esbuild result.');
        }

        const entryChunk = getAppEntryPoint(initialOptions, result.metafile);
        const mergeStrategy = mergeStrategyFactory(
          entryChunk,
          result.metafile,
          options.mergeStrategy
        );
        const loaderPlugin = esbuildOutputLoaderPlugin(
          result.outputFiles,
          initialOptions
        );
        const rebundledOutput = await rolldownRebundle(
          entryChunk,
          Boolean(initialOptions.sourcemap),
          mergeStrategy,
          loaderPlugin
        );
        const { newMetafileOutputs, newOutputFiles } =
          rolldownOutputsToEsbuildOutputs(rebundledOutput, result.metafile);
        const preservedOutputFiles = result.outputFiles.filter(
          (file) => !isJavaScriptOutputFile(file.path)
        );
        const preservedMetafileOutputs = Object.fromEntries(
          Object.entries(result.metafile.outputs).filter(
            ([outputPath]) => !isJavaScriptOutputFile(outputPath)
          )
        );

        result.outputFiles = [...preservedOutputFiles, ...newOutputFiles];
        result.metafile.outputs = {
          ...preservedMetafileOutputs,
          ...newMetafileOutputs,
        };

        const { initialChunksFile, initialChunksFileMeta } = initialChunks(
          entryChunk,
          newMetafileOutputs,
          'main-chunks.json'
        );

        result.outputFiles.push(initialChunksFile);
        result.metafile.outputs[initialChunksFile.path] =
          initialChunksFileMeta;
      });
    },
  };
}
