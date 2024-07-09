import { createHash } from 'crypto';

export function hashFromOutputPaths(paths: string[]): string {
    return createHash('sha256').update(paths.join('')).digest('hex').substring(0, 8).toUpperCase();
}
