import { Metafile } from 'esbuild';
import { getChunkNameByEntryPoint, importsInEntryPoint } from "./chunk.utils";

describe('importsInEntryPoint', () => {
    it('should return a list of all non dynamic imports of an entry point', () => {
        const MOCK_OUTPUTS = {
            'entry.js': {
                imports: [{ path: 'a.js', kind: 'import-statement' }, { path: 'b.js', kind: 'dynamic-import' }],
            },
            'a.js': {
                imports: [{ path: 'c.js', kind: 'import-statement' }],
            },
            'b.js': {
                imports: [{ path: 'c.js', kind: 'import-statement' }],
            },
            'c.js': {
                imports: [],
            },
        } as unknown as Metafile['outputs'];

        expect(importsInEntryPoint('entry.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['entry.js', 'a.js', 'c.js']));

        expect(importsInEntryPoint('b.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['b.js', 'c.js']));

        expect(importsInEntryPoint('c.js', MOCK_OUTPUTS)).toEqual(expect.arrayContaining(['c.js']));
    });
});

describe('getChunkNameByEntryPoint', () => {
    it('should return the path of the chunk with the entryPoint', () => {
        const MOCK_OUTPUTS = {
            'main-X.js': {
                entryPoint: 'package/src/main.ts',
            },
        } as unknown as Metafile['outputs'];

        expect(getChunkNameByEntryPoint('package/src/main.ts', MOCK_OUTPUTS)).toBe('main-X.js');

        expect(() => getChunkNameByEntryPoint('package/src/invalid.ts', MOCK_OUTPUTS)).toThrow(`Unable to find package/src/invalid.ts entryPoint`);
    });
});
