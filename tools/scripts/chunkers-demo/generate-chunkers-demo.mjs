#!/usr/bin/env node

/**
 * Main generator script for the chunkers demo
 * Orchestrates the generation of all components, constants, and routes
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, getCalculatedConfig } from './config.js';
import { cleanAndCreateDirectory } from './file-utils.js';
import { generateConstantFiles } from './constants-generator.js';
import { generateRootChunkerComponent, generateChunkComponents } from './component-generator.js';
import { generateRootChunkerRoutes, generateChunkRoutes } from './routes-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Calculate paths
const PROJECT_ROOT = join(__dirname, '../../../packages/kitchen-sink/src');
const CHUNKERS_PATH = join(PROJECT_ROOT, CONFIG.CHUNKERS_DIR);

/**
 * Main generation function
 */
async function generateChunkersDemo() {
    const calculated = getCalculatedConfig();
    
    console.log('🚀 Starting chunkers demo generation...');
    console.log(`📊 Configuration:`);
    console.log(`   - Total size: ${CONFIG.TOTAL_SIZE_MB}MB`);
    console.log(`   - Number of chunks: ${CONFIG.NUMBER_OF_CHUNKS}`);
    console.log(`   - Each constant: ~${calculated.kbPerConstant}KB`);
    console.log(`   - Output directory: ${CHUNKERS_PATH}`);
    console.log('');
    
    try {
        // 1. Clean and create chunkers directory
        cleanAndCreateDirectory(CHUNKERS_PATH);
        
        // 2. Generate individual constant files
        await generateConstantFiles(CHUNKERS_PATH);
        
        // 3. Generate root chunker component
        const rootComponentPath = join(CHUNKERS_PATH, CONFIG.ROOT_COMPONENT_FILE);
        generateRootChunkerComponent(rootComponentPath);
        
        // 4. Generate individual chunk components
        await generateChunkComponents(CHUNKERS_PATH);
        
        // 5. Generate chunk routes
        const chunkRoutesPath = join(CHUNKERS_PATH, 'chunk.routes.ts');
        generateChunkRoutes(chunkRoutesPath);
        
        // 6. Generate root chunker routes
        const rootChunkerRoutesPath = join(CHUNKERS_PATH, 'root-chunker.routes.ts');
        generateRootChunkerRoutes(rootChunkerRoutesPath);
        
        // Success summary
        console.log('');
        console.log('✅ Chunkers demo generation complete!');
        console.log(`📊 Generated:`);
        console.log(`   - ${CONFIG.NUMBER_OF_CHUNKS} individual constant files (~${CONFIG.TOTAL_SIZE_MB}MB total)`);
        console.log(`   - 1 root chunker component`);
        console.log(`   - ${CONFIG.NUMBER_OF_CHUNKS} individual chunk components`);
        console.log(`   - Generated chunk routes with ${CONFIG.NUMBER_OF_CHUNKS} lazy routes`);
        console.log(`   - Generated root chunker routes`);
        console.log('');
        console.log('🚀 All files generated in shared/chunkers directory!');
        console.log('📝 To use: Import RootChunkerComponent and chunkerRoutes in your app as needed.');
        
    } catch (error) {
        console.error('❌ Error during generation:', error);
        process.exit(1);
    }
}

// Run the generator if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateChunkersDemo().catch(console.error);
}

export { generateChunkersDemo };
