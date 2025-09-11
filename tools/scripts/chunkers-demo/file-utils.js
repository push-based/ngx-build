import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * File system utilities for the chunkers demo generator
 */

/**
 * Clean and create a directory
 * @param {string} dirPath - Path to the directory
 */
export function cleanAndCreateDirectory(dirPath) {
    if (existsSync(dirPath)) {
        console.log(`🧹 Cleaning existing directory: ${dirPath}`);
        rmSync(dirPath, { recursive: true, force: true });
    }
    mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
}

/**
 * Write content to a file
 * @param {string} filePath - Path to the file
 * @param {string} content - Content to write
 * @param {string} description - Description for logging
 */
export function writeFile(filePath, content, description = 'file') {
    writeFileSync(filePath, content);
    console.log(`📝 Generated ${description}: ${filePath}`);
}

/**
 * Generate a unique string for constants
 * @param {number} index - Index of the constant
 * @param {number} targetLength - Target length of the string
 * @returns {string} Generated unique string
 */
export function generateUniqueString(index, targetLength) {
    const baseString = `CONSTANT_${String(index).padStart(3, '0')}_`;
    const remainingLength = targetLength - baseString.length;
    const filler = 'X'.repeat(Math.max(0, remainingLength));
    return baseString + filler;
}

/**
 * Get formatted timestamp
 * @returns {string} ISO timestamp
 */
export function getTimestamp() {
    return new Date().toISOString();
}
