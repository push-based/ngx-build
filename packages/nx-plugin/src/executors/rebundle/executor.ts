import { PromiseExecutor } from '@nx/devkit';
import { RebundleExecutorSchema } from './schema';
import { join, normalize } from "node:path";
import { getChunkNameByEntryPoint, importsInEntryPoint } from "./utils/chunk.utils";
import { ensureDirSync, readJsonSync, rmSync } from "fs-extra";
import { Metafile } from "esbuild";
import { hashFromOutputPaths } from "./utils";
import { rollup } from "rollup";
import { chunkNamingStrategy, chunkSplittingStrategy, sourceMapLoader } from "./utils/rollup.utils";

const POLYFILLS_ENTRY_POINT = 'angular:polyfills:angular:polyfills';

const runExecutor: PromiseExecutor<RebundleExecutorSchema> = async (
    { main, targetOutputPath, outputPath}
) => {
  const outputDir = normalize(outputPath);
  const { outputs } = readJsonSync(join(targetOutputPath, 'stats.json')) as unknown as Metafile;
  const mainChunkName = getChunkNameByEntryPoint(main, outputs);
  const polyfillsChunkName = getChunkNameByEntryPoint(POLYFILLS_ENTRY_POINT, outputs);

  const initialChunks = importsInEntryPoint(mainChunkName, outputs).filter((path) => path !== mainChunkName);
  const initialChunksHash = hashFromOutputPaths(initialChunks);
  const initialChunkName = `chunk-i-${initialChunksHash}.js`;

  console.log('initial chunks', initialChunks, initialChunksHash, initialChunkName)

  const { write, close } = await rollup({
    input: [join(targetOutputPath, mainChunkName)],
    treeshake: false,
    plugins: [sourceMapLoader]
  });

  ensureDirSync(outputDir);
  rmSync(outputDir, { recursive: true });

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
