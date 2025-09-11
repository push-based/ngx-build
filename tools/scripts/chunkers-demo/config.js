/**
 * Configuration constants for the chunkers demo generator
 * Modify these values to change the generation behavior
 */
const TOTAL_SIZE_MB = 3;
const NUMBER_OF_CONSTANTS = 500;
const NUMBER_OF_COMPONENTS = 0;

export const CONFIG = {
    // Size and quantity settings
    TOTAL_SIZE_MB,
    NUMBER_OF_CONSTANTS,
    NUMBER_OF_COMPONENTS, // Number of components to spread constants across
    
    // Directory structure
    CHUNKERS_DIR: `shared/chunkers-${TOTAL_SIZE_MB}MB-${NUMBER_OF_CONSTANTS}constants-${NUMBER_OF_COMPONENTS}components`,
    CONSTANTS_DIR: `shared/chunkers-${TOTAL_SIZE_MB}MB-${NUMBER_OF_CONSTANTS}constants-${NUMBER_OF_COMPONENTS}components/constants`,
    CHUNKS_DIR: `shared/chunkers-${TOTAL_SIZE_MB}MB-${NUMBER_OF_CONSTANTS}constants-${NUMBER_OF_COMPONENTS}components/chunks`,
    
    // File naming patterns
    CONSTANTS_FILE: 'constants.ts',
    ROOT_COMPONENT_FILE: 'root-chunker.component.ts',
    CHUNK_FILE_PREFIX: 'chunk-',
    CHUNK_FILE_SUFFIX: '.component.ts',
    
    // Component naming patterns
    ROOT_COMPONENT_NAME: 'RootChunkerComponent',
    CHUNK_COMPONENT_PREFIX: 'Chunk',
    CHUNK_COMPONENT_SUFFIX: 'Component',
    
    // Route patterns
    CHUNK_ROUTE_PREFIX: 'chunk-',
    
    // Generated content metadata
    GENERATED_BY: 'chunkers-demo-generator',
    VERSION: '1.0.0'
};

/**
 * Calculate derived configuration values
 */
export function getCalculatedConfig() {
    const totalSizeBytes = CONFIG.TOTAL_SIZE_MB * 1024 * 1024;
    const bytesPerConstant = Math.floor(totalSizeBytes / CONFIG.NUMBER_OF_CONSTANTS);
    const charsPerConstant = Math.floor(bytesPerConstant);
    const chunksPerComponent = Math.floor(CONFIG.NUMBER_OF_CONSTANTS / CONFIG.NUMBER_OF_COMPONENTS);
    const remainingChunks = CONFIG.NUMBER_OF_CONSTANTS % CONFIG.NUMBER_OF_COMPONENTS;
    
    return {
        totalSizeBytes,
        bytesPerConstant,
        charsPerConstant,
        kbPerConstant: (bytesPerConstant / 1024).toFixed(2),
        chunksPerComponent,
        remainingChunks
    };
}
