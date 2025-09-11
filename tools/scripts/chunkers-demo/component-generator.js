import { CONFIG, getCalculatedConfig } from './config.js';
import { writeFile } from './file-utils.js';
import { mkdir } from 'fs/promises';

/**
 * Component generators
 * Responsible for generating Angular components
 */

/**
 * Generate the root chunker component
 * @param {string} outputPath - Path where to write the component file
 */
export function generateRootChunkerComponent(outputPath) {
    const imports = [];
    const templateBindings = [];
    
    // Generate imports and template bindings for all constants
    for (let i = 1; i <= CONFIG.NUMBER_OF_CONSTANTS; i++) {
        const constantName = `CONSTANT_${String(i).padStart(3, '0')}`;
        const constantFileName = `constant-${String(i).padStart(3, '0')}`;
        imports.push(`import { ${constantName} } from './constants/${constantFileName}';`);
        templateBindings.push(`    <div class="constant-display">
      <h3>${constantName}</h3>
      <p>{{ ${constantName} }}</p>
    </div>`);
    }
    
    const content = `import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

${imports.join('\n')}

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'app-root-chunker',
  template: \`
    <div class="root-chunker">
      <h1>Root Chunker Component</h1>
      <p>This component imports and displays all ${CONFIG.NUMBER_OF_CONSTANTS} constants</p>
      
      <router-outlet></router-outlet>
      
      <div class="constants-grid">
${templateBindings.join('\n')}
      </div>
    </div>
  \`,
  styles: [\`
    .root-chunker {
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    
    .constants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 4px;
      margin: 20px 0;
    }
    
    .constant-display {
      border: 1px solid #ccc;
      padding: 4px;
      border-radius: 2px;
      background: #f9f9f9;
    }
    
    .constant-display h3 {
      margin: 0 0 2px 0;
      color: #333;
      font-size: 8px;
      font-weight: bold;
    }
    
    .constant-display p {
      margin: 0;
      font-size: 6px;
      word-break: break-all;
      color: #666;
      line-height: 1.1;
    }
    
    .router-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #333;
    }
    
    .chunk-nav {
      margin: 20px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .chunk-nav a {
      color: #007acc;
      text-decoration: none;
      padding: 5px 10px;
      border-radius: 4px;
      background: white;
      border: 1px solid #ddd;
      font-size: 12px;
    }
    
    .chunk-nav a:hover {
      background: #007acc;
      color: white;
    }
  \`]
})
export class ${CONFIG.ROOT_COMPONENT_NAME} {
${Array.from({length: CONFIG.NUMBER_OF_CONSTANTS}, (_, i) => {
  const constantName = `CONSTANT_${String(i + 1).padStart(3, '0')}`;
  return `  ${constantName} = ${constantName};`;
}).join('\n')}
}
`;

    writeFile(outputPath, content, 'root chunker component');
}

/**
 * Generate individual chunk components
 * @param {string} outputDir - Directory where to write the component files
 */
export async function generateChunkComponents(outputDir) {
    const chunksDir = `${outputDir}/chunks`;
    const calculated = getCalculatedConfig();
    
    console.log(`🔧 Generating ${CONFIG.NUMBER_OF_COMPONENTS} individual chunk components...`);
    console.log(`📁 Creating chunks directory: ${chunksDir}`);
    console.log(`📊 Distribution: ${calculated.chunksPerComponent} chunks per component (${calculated.remainingChunks} components get +1 chunk)`);
    
    // Create chunks directory
    await mkdir(chunksDir, { recursive: true });
    
    for (let i = 1; i <= CONFIG.NUMBER_OF_COMPONENTS; i++) {
        const componentName = `${CONFIG.CHUNK_COMPONENT_PREFIX}${String(i).padStart(3, '0')}${CONFIG.CHUNK_COMPONENT_SUFFIX}`;
        const fileName = `${CONFIG.CHUNK_FILE_PREFIX}${String(i).padStart(3, '0')}${CONFIG.CHUNK_FILE_SUFFIX}`;
        const filePath = `${chunksDir}/${fileName}`;
        
        // Calculate which constants this component should import
        const constantsForThisComponent = [];
        const imports = [];
        const templateBindings = [];
        const classProperties = [];
        
        // Calculate the range of constants for this component
        const startConstant = (i - 1) * calculated.chunksPerComponent + 1;
        const endConstant = Math.min(i * calculated.chunksPerComponent, CONFIG.NUMBER_OF_CONSTANTS);
        
        // Add extra constant for remaining chunks if this is one of the first components
        const extraConstant = i <= calculated.remainingChunks ? 1 : 0;
        const actualEndConstant = Math.min(endConstant + extraConstant, CONFIG.NUMBER_OF_CONSTANTS);
        
        for (let j = startConstant; j <= actualEndConstant; j++) {
            const constantName = `CONSTANT_${String(j).padStart(3, '0')}`;
            constantsForThisComponent.push(constantName);
            imports.push(`import { ${constantName} } from '../constants/constant-${String(j).padStart(3, '0')}';`);
            templateBindings.push(`      <div class="constant-display">
        <h3>${constantName}</h3>
        <p>{{ ${constantName} }}</p>
      </div>`);
            classProperties.push(`  ${constantName} = ${constantName};`);
        }
        
        const content = `import { Component } from '@angular/core';
${imports.join('\n')}

@Component({
  standalone: true,
  selector: 'app-chunk-${String(i).padStart(3, '0')}',
  template: \`
    <div class="chunk-component">
      <h2>Chunk ${String(i).padStart(3, '0')} Component</h2>
      <p>This component displays ${constantsForThisComponent.length} constants: ${constantsForThisComponent.join(', ')}</p>
      <div class="constants-container">
${templateBindings.join('\n')}
      </div>
    </div>
  \`,
  styles: [\`
    .chunk-component {
      padding: 20px;
      margin: 10px 0;
      border: 2px solid #007acc;
      border-radius: 8px;
      background: #f0f8ff;
      font-family: Arial, sans-serif;
    }
    
    .chunk-component h2 {
      color: #007acc;
      margin: 0 0 10px 0;
    }
    
    .constants-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      margin-top: 15px;
    }
    
    .constant-display {
      background: white;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }
    
    .constant-display h3 {
      margin: 0 0 5px 0;
      color: #333;
      font-size: 12px;
      font-weight: bold;
    }
    
    .constant-display p {
      margin: 0;
      word-break: break-all;
      font-family: monospace;
      font-size: 10px;
      color: #666;
    }
  \`]
})
export class ${componentName} {
${classProperties.join('\n')}
}
`;
        
        writeFile(filePath, content, `chunk component ${String(i).padStart(3, '0')}`);
    }
}
