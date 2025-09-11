# Chunkers Demo Generator

A modular script generator for creating a large-scale Angular demo application to test chunking behavior.

## Structure

The generator is organized into focused modules following the single responsibility principle:

### Core Modules

- **`config.js`** - Configuration constants and calculated values
- **`file-utils.js`** - File system operations and utility functions
- **`constants-generator.js`** - Generates the large constants file
- **`component-generator.js`** - Generates Angular components
- **`routes-generator.js`** - Generates and updates route configurations
- **`generate-chunkers-demo.mjs`** - Main orchestrator script

## Configuration

Edit `config.js` to modify generation behavior:

```javascript
export const CONFIG = {
  TOTAL_SIZE_MB: 10,        // Total size of all constants
  NUMBER_OF_CONSTANTS: 550,    // Number of constants/components
  CHUNKERS_DIR: 'shared/chunkers', // Output directory
  // ... other settings
};
```

## Usage

```bash
# Make executable (first time only)
chmod +x tools/scripts/chunkers-demo/generate-chunkers-demo.mjs

# Run the generator
node tools/scripts/chunkers-demo/generate-chunkers-demo.mjs
```

## What It Generates

All files are generated in the `shared/chunkers/` directory and are completely self-contained:

1. **Individual Constant Files** (`shared/chunkers/constant-001.ts` through `constant-010.ts`)
   - 10 individual constant files totaling ~1MB
   - Each constant file is ~102KB
   - Better tree-shaking and modularity

2. **Root Chunker Component** (`shared/chunkers/root-chunker.component.ts`)
   - Imports all 10 constants from individual files
   - Displays all constants in a grid
   - Contains router outlet for lazy-loaded components
   - Includes navigation for chunk components

3. **Individual Chunk Components** (`shared/chunkers/chunk-001.component.ts` through `chunk-010.component.ts`)
   - Each imports and displays one constant from its specific constant file
   - Lazy-loaded via routing

4. **Chunk Routes** (`shared/chunkers/chunk.routes.ts`)
   - 200 lazy routes for individual chunk components
   - Self-contained chunk routing configuration

5. **Root Chunker Routes** (`shared/chunkers/root-chunker.routes.ts`)
   - Lazy-loaded root component (empty path)
   - Imports and uses chunk routes as children
   - Parent-child routing structure

## Usage

After generation, the files are ready to use:

1. **Import the root component** in your app:
   ```typescript
   import { RootChunkerComponent } from './shared/chunkers/root-chunker.component';
   ```

2. **Import the routes** if you want to use the chunker routing:
   ```typescript
   import { rootChunkerRoutes } from './shared/chunkers/root-chunker.routes';
   // or import individual chunk routes
   import { chunkRoutes } from './shared/chunkers/chunk.routes';
   ```

3. **Add to your app routes** if needed:
   ```typescript
   {
     path: 'chunkers',
     loadChildren: () => import('./shared/chunkers/root-chunker.routes').then(m => m.rootChunkerRoutes)
   }
   ```

## Testing

- Navigate to `/chunkers` to see the root chunker component (lazy-loaded)
- Navigate to `/chunkers/chunk-001` through `/chunkers/chunk-010` to test child route lazy loading
- The root component will display with its router outlet showing the child components
- Use browser dev tools to observe chunk loading behavior
- Monitor bundle sizes and loading performance

## Customization

Each module can be modified independently:
- Change constants size/quantity in `config.js`
- Modify component templates in `component-generator.js`
- Adjust routing patterns in `routes-generator.js`
- Add new file operations in `file-utils.js`
