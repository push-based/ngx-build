import { readFileSync } from 'node:fs';
import { Metafile } from 'esbuild';

export function loadStatsFile(filePath: string): Metafile {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
