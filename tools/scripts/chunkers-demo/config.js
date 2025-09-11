/**
 * Configuration constants for the chunkers demo generator
 * Modify these values to change the generation behavior
 */

export const CONFIG = {
    // Size and quantity settings
    TOTAL_SIZE_MB: 3,
    NUMBER_OF_CHUNKS: 550,
    
    // Directory structure
    CHUNKERS_DIR: 'shared/chunkers',
    CONSTANTS_DIR: 'shared/chunkers/constants',
    CHUNKS_DIR: 'shared/chunkers/chunks',
    
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
    const bytesPerConstant = Math.floor(totalSizeBytes / CONFIG.NUMBER_OF_CHUNKS);
    const charsPerConstant = Math.floor(bytesPerConstant);
    
    return {
        totalSizeBytes,
        bytesPerConstant,
        charsPerConstant,
        kbPerConstant: (bytesPerConstant / 1024).toFixed(2)
    };
}
