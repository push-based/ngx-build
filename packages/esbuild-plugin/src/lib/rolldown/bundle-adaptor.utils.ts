import { Metafile, OutputFile } from 'esbuild';
import { assert } from 'node:console';
import { OutputChunk, RolldownOutput } from 'rolldown';

import { MergeStrategyReverseLookup } from '../merge-strategy.utils';

export function rolldownToEsbuildOutputs(rollupOutput: RolldownOutput['output'], { outputs }: Metafile) {
    const newOutputFiles: OutputFile[] = [];
    const newMetafileOutputs: Metafile['outputs'] = {};
    console.log(rollupOutput);
  rollupOutput
    .filter((output): output is OutputChunk => output.type === 'chunk')
    .forEach((output) => {
      const file = toEsbuildOutputFile(output.fileName, output.code);

      newOutputFiles.push(file);
      newMetafileOutputs[output.fileName] = {
        bytes: file.contents.length,
        imports: mergedImports(output.imports, output.dynamicImports),
        inputs: mergedInputs(
          output.moduleIds.map((chunk) => {
            if (chunk === 'rolldown:runtime') {
              // TODO get real number
              return { [chunk]: { bytesInOutput: 0 } };
            }
            return outputs[chunk].inputs;
          }),
        ),
        exports: output.exports,
      };
      if (output.facadeModuleId) {
        newMetafileOutputs[output.fileName].entryPoint = outputs[output.facadeModuleId].entryPoint;
      }
      if (output.map && output.sourcemapFileName) {
        const file = toEsbuildOutputFile(output.sourcemapFileName, output.map.toString());
        newOutputFiles.push(file);
        newMetafileOutputs[output.sourcemapFileName] = { imports: [], exports: [], inputs: {}, bytes: file.contents.length };
      }
    });
    return { newOutputFiles, newMetafileOutputs };
}

function mergedEntryPoint(mergeChunksEntryPoint: Metafile['outputs'][string]['entryPoint'][]): Metafile['outputs'][string]['entryPoint'] {
    const entryPoints = mergeChunksEntryPoint.filter(Boolean);
    assert(entryPoints.length <= 1, 'Warning merged chunk contained multiple entryPoints', entryPoints.length, entryPoints);
    return entryPoints[0];
}

function mergedImports(imports: string[], dynamicImports: string[]): Metafile['outputs'][string]['imports'] {
    return [
        imports.map((path): Metafile['outputs'][string]['imports'][number] => ({ path, kind: 'import-statement' })),
        dynamicImports.map((path): Metafile['outputs'][string]['imports'][number] => ({ path, kind: 'dynamic-import' })),
    ].flat();
}

function mergedInputs(mergedChunksInputs: Metafile['outputs'][string]['inputs'][]): Metafile['outputs'][string]['inputs'] {
    const inputs: Metafile['outputs'][string]['inputs'] = {};
    mergedChunksInputs.forEach((chunkInputs) => {
        Object.entries(chunkInputs).forEach(([key, value]) => {
            if (!Object.prototype.hasOwnProperty.call(inputs, key)) {
                inputs[key] = value;
            } else {
                inputs[key].bytesInOutput += value.bytesInOutput;
            }
        });
    });
    return inputs;
}

function toEsbuildOutputFile(filename: string, code: string): OutputFile {
    return {
        path: filename,
        contents: new TextEncoder().encode(code),
        hash: getHashFromFileName(filename),
        get text() {
            return new TextDecoder().decode(this.contents);
        },
    };
}

// Extracts the hash from the file name eg. chunk-3UZA2KDL.js -> 3UZA2KDL
function getHashFromFileName(name: string): string {
    return name.replace(/(\.js(\.map)?)$/, '').slice(-8);
}
