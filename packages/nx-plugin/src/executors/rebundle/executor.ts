import { join, normalize } from "node:path";
import { readJsonSync } from "fs-extra";
import { PromiseExecutor } from '@nx/devkit';
import { rollup } from "rollup";
import { Metafile } from "esbuild";

import { RebundleExecutorSchema } from './schema';
import { getChunkNameByEntryPoint, importsInEntryPoint } from "./utils/chunk.utils";
import { configOptions, hashFromOutputPaths, removeOldChunks } from "./utils";
import { chunkNamingStrategy, chunkSplittingStrategy, sourceMapLoader } from "./utils/rollup.utils";

const POLYFILLS_ENTRY_POINT = 'angular:polyfills:angular:polyfills';

const runExecutor: PromiseExecutor<RebundleExecutorSchema> = async (options, context) => {
  const { main, targetOutputPath } = configOptions(options, context);
  const outputDir = normalize(targetOutputPath);
  const { outputs } = readJsonSync(join(targetOutputPath, 'stats.json')) as unknown as Metafile;

  const mainChunkName = getChunkNameByEntryPoint(main, outputs);
  const polyfillsChunkName = getChunkNameByEntryPoint(POLYFILLS_ENTRY_POINT, outputs);

  const initialChunks = importsInEntryPoint(mainChunkName, outputs).filter((path) => path !== mainChunkName);
  const initialChunksHash = hashFromOutputPaths(initialChunks);

  const entryPoints = [mainChunkName, polyfillsChunkName].map((chunk) => join(targetOutputPath, chunk));

  const { write, close } = await rollup({
    input: entryPoints,
    treeshake: false,
    plugins: [sourceMapLoader]
  });

  await removeOldChunks(outputs, targetOutputPath);

  await write({
    dir: outputDir,
    sourcemap: true,
    manualChunks: chunkSplittingStrategy(initialChunks, initialChunksHash),
    chunkFileNames: chunkNamingStrategy(initialChunksHash),
  });

  await close();

  return {
    success: true,
  };
};

export default runExecutor;
