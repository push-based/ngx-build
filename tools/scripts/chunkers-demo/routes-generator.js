import { CONFIG } from './config.js';
import { writeFile } from './file-utils.js';

/**
 * Routes generator
 * Responsible for generating chunker routes files
 */

/**
 * Generate root chunker routes content
 * @returns {string} The content for root-chunker.routes.ts
 */
export function generateRootChunkerRoutesContent() {
    return `import { Route } from '@angular/router';
import { chunkRoutes } from './chunk.routes';

export const rootChunkerRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./root-chunker.component').then(m => m.${CONFIG.ROOT_COMPONENT_NAME}),
        children: chunkRoutes
    }
];
`;
}

/**
 * Generate chunk routes content
 * @returns {string} The content for chunk.routes.ts
 */
export function generateChunkRoutesContent() {
    const routes = [];
    
    // Generate routes for all chunk components
    for (let i = 1; i <= CONFIG.NUMBER_OF_CHUNKS; i++) {
        const chunkNum = String(i).padStart(3, '0');
        const componentName = `${CONFIG.CHUNK_COMPONENT_PREFIX}${chunkNum}${CONFIG.CHUNK_COMPONENT_SUFFIX}`;
        const fileName = `${CONFIG.CHUNK_FILE_PREFIX}${chunkNum}${CONFIG.CHUNK_FILE_SUFFIX}`;
        
        routes.push(`    {
        path: 'chunk-${chunkNum}',
        loadComponent: () => import('./chunks/chunk-${chunkNum}.component').then(m => m.${componentName})
    }`);
    }
    
    return `import { Route } from '@angular/router';

export const chunkRoutes: Route[] = [
${routes.join(',\n')}
];
`;
}

/**
 * Generate root chunker routes file
 * @param {string} outputPath - Path to root-chunker.routes.ts
 */
export function generateRootChunkerRoutes(outputPath) {
    const content = generateRootChunkerRoutesContent();
    writeFile(outputPath, content, 'root chunker routes');
}

/**
 * Generate chunk routes file
 * @param {string} outputPath - Path to chunk.routes.ts
 */
export function generateChunkRoutes(outputPath) {
    const content = generateChunkRoutesContent();
    writeFile(outputPath, content, 'chunk routes');
}
