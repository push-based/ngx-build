import { Plugin, OutputOptions } from 'rollup';
import { readJson, readFile } from "fs-extra";
import { sep } from "node:path";

export const sourceMapLoader: Plugin = {
    name: 'source-map-loader',
    async load(id: string) {
        const [code, map] = await Promise.all([
            readFile(id, 'utf-8'),
            readJson(`${id}.map`, 'utf-8')
        ]);
        return { code, map };
    }
};

export const chunkSplittingStrategy = (initialChunks: string[], initialChunksHash: string): OutputOptions['manualChunks'] => {
    return (id) => {
        const chunkName = id.split(sep).at(-1)!;
        if (initialChunks.includes(chunkName)) {
            return initialChunksHash;
        }
    }
}

export const chunkNamingStrategy = (initialChunksHash: string): OutputOptions['chunkFileNames'] => {
    return (chunkInfo) => {
        if (chunkInfo.name === initialChunksHash) {
            return `chunk-i-${initialChunksHash}.js`;
        }
        return `${chunkInfo.name.substring(0, chunkInfo.name.lastIndexOf('-'))}-[hash].js`;
    }
}
