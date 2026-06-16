# Size-Based Chunk Merging Documentation

## Overview

The esbuild plugin now includes advanced size-based chunk merging capabilities that intelligently consolidate small chunks to optimize bundle performance. This feature extends the existing merge strategy with analysis-driven chunk consolidation.

## Features

### 🔍 Intelligent Size Analysis
- Automatically detects small chunks under configurable thresholds (default: 8KB)
- Estimates gzip compression impact for network optimization
- Provides comprehensive bundle analysis and recommendations

### 🎯 Smart Merge Detection
- **Shared Dependencies**: Prioritizes chunks with common imports
- **Geographic Proximity**: Merges chunks close in the dependency graph  
- **Load Timing**: Considers chunks likely to be requested together
- **Size Efficiency**: Optimizes for maximum size reduction

### ⚡ Performance Optimizations
- Reduces HTTP request overhead (major performance win)
- Maintains bundle splitting benefits for larger chunks
- Preserves critical path and dynamic import boundaries
- Configurable constraints for fine-tuned control

## Usage

### Basic Usage (Auto-Configuration)

```typescript
import optimizeChunksPlugin from '@your-org/esbuild-plugin';

// Auto-analyzes bundle and applies recommended settings
const plugin = optimizeChunksPlugin({
  autoAnalyze: true,    // Default: true
  verbose: true         // Show detailed optimization logs
});
```

### Manual Configuration

```typescript
import optimizeChunksPlugin from '@your-org/esbuild-plugin';

const plugin = optimizeChunksPlugin({
  enableSizeBasedMerging: true,
  verbose: true,
  sizeBasedOptions: {
    sizeAnalysis: {
      sizeThreshold: 6144,     // 6KB threshold (default: 8KB)
      maxCombinedSize: 24576,  // 24KB max combined (default: 32KB)
      gzipRatio: 0.3           // 30% compression estimate
    },
    constraints: {
      maxCombinedSize: 24576,
      preserveCriticalPath: true,      // Don't merge entry-point chunks
      respectDynamicBoundaries: true,  // Don't merge across dynamic imports
      minPriorityScore: 25,           // Minimum score for merge consideration
      maxChunksPerMerge: 3            // Max chunks per merge group
    }
  }
});
```

### Advanced Usage with Bundle Analysis

```typescript
import { analyzeBundleCharacteristics } from '@your-org/esbuild-plugin/merge-strategy-v3';

// Analyze bundle characteristics first
const analysis = analyzeBundleCharacteristics(metafile);
console.log('Bundle Analysis:', analysis);

// Use analysis-driven configuration
const plugin = optimizeChunksPlugin({
  enableSizeBasedMerging: true,
  sizeBasedOptions: analysis.recommendations
});
```

## Configuration Options

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableSizeBasedMerging` | `boolean` | auto-detected | Enable size-based chunk merging |
| `autoAnalyze` | `boolean` | `true` | Auto-analyze bundle for optimal settings |
| `verbose` | `boolean` | `false` | Enable detailed logging |
| `sizeBasedOptions` | `SizeBasedMergingOptions` | `{}` | Fine-tune merging behavior |

### Size Analysis Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sizeThreshold` | `number` | `8192` | Size threshold in bytes for merge eligibility |
| `maxCombinedSize` | `number` | `32768` | Maximum combined size for merged chunks |
| `gzipRatio` | `number` | `0.3` | Estimated gzip compression ratio |

### Merging Constraints

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxCombinedSize` | `number` | `32768` | Maximum size for merged chunks |
| `preserveCriticalPath` | `boolean` | `true` | Keep critical path chunks separate |
| `respectDynamicBoundaries` | `boolean` | `true` | Don't merge across dynamic imports |
| `minPriorityScore` | `number` | `20` | Minimum priority score for merging |
| `maxChunksPerMerge` | `number` | `4` | Maximum chunks per merge operation |

## Performance Impact

### Expected Optimizations

- **HTTP Requests**: 30-50% reduction in chunk count for fragmented bundles
- **Total Payload**: 5-10% reduction through better compression ratios
- **Cache Efficiency**: Maintained through content-hash naming
- **Initial Load**: Preserved or improved through intelligent consolidation

### Bundle Analysis Metrics

The plugin provides comprehensive metrics:

```typescript
{
  totalChunksBefore: 25,
  totalChunksAfter: 18,
  requestReduction: 7,           // 7 fewer HTTP requests
  estimatedSizeReduction: 3500,  // ~3.5KB saved from HTTP overhead
  sizeBasedMergesApplied: 4,     // 4 merge operations
  averageChunkSizeBefore: 8240,  // Average chunk size before
  averageChunkSizeAfter: 11540   // Average chunk size after
}
```

## Best Practices

### 1. Start with Auto-Analysis
Let the plugin analyze your bundle and apply recommended settings:
```typescript
optimizeChunksPlugin({ autoAnalyze: true, verbose: true })
```

### 2. Monitor Bundle Reports
Use tools like webpack-bundle-analyzer or similar to validate results:
```typescript
// Enable detailed logging to see merge decisions
optimizeChunksPlugin({ verbose: true })
```

### 3. Adjust Thresholds Based on App Size
- **Small apps** (<1MB): More aggressive merging (12KB threshold)
- **Medium apps** (1-5MB): Balanced approach (8KB threshold) 
- **Large apps** (>5MB): Conservative approach (6KB threshold)

### 4. Consider Dynamic Import Patterns
```typescript
// For apps with many dynamic imports
optimizeChunksPlugin({
  sizeBasedOptions: {
    constraints: {
      respectDynamicBoundaries: true,  // Preserve lazy loading benefits
      maxChunksPerMerge: 2            // Conservative merging
    }
  }
})
```

## Example Scenarios

### Scenario 1: Micro-Frontend Architecture
```typescript
// Many small feature chunks
optimizeChunksPlugin({
  enableSizeBasedMerging: true,
  sizeBasedOptions: {
    sizeAnalysis: { sizeThreshold: 12288 }, // 12KB threshold
    constraints: {
      preserveCriticalPath: true,
      respectDynamicBoundaries: false,      // Allow cross-boundary merging
      maxChunksPerMerge: 3
    }
  }
})
```

### Scenario 2: Component Library
```typescript
// Many utility and component chunks
optimizeChunksPlugin({
  enableSizeBasedMerging: true,
  sizeBasedOptions: {
    sizeAnalysis: { sizeThreshold: 6144 },  // 6KB threshold
    constraints: {
      minPriorityScore: 15,                 // Lower threshold for libraries
      maxChunksPerMerge: 5                  // Allow larger merge groups
    }
  }
})
```

### Scenario 3: Performance-Critical Application
```typescript
// Conservative approach focusing on critical path
optimizeChunksPlugin({
  enableSizeBasedMerging: true,
  sizeBasedOptions: {
    constraints: {
      preserveCriticalPath: true,
      respectDynamicBoundaries: true,
      minPriorityScore: 30,                 // High threshold
      maxCombinedSize: 16384                // Smaller combined chunks
    }
  }
})
```

## Troubleshooting

### Common Issues

1. **No merges applied**: Check if chunks meet size threshold and priority requirements
2. **Unexpected merges**: Adjust `minPriorityScore` or enable stricter constraints
3. **Performance regression**: Ensure `preserveCriticalPath` is enabled
4. **Bundle size increase**: Check if `maxCombinedSize` is appropriate for your use case

### Debug Configuration

```typescript
optimizeChunksPlugin({
  verbose: true,  // Detailed logging
  sizeBasedOptions: {
    constraints: {
      minPriorityScore: 0  // Show all candidates (for debugging)
    }
  }
})
```

## Migration Guide

### From V2 to V3

The new size-based merging is backward compatible:

```typescript
// V2 (still works)
const strategy = mergeStrategyV2(entryPoint, metafile);

// V3 (enhanced)
const result = mergeStrategyV3(entryPoint, metafile, {
  enableSizeBasedMerging: true
});
const strategy = result.mergeStrategy;
```

### Gradual Rollout

1. **Phase 1**: Enable with `autoAnalyze: true` and monitor
2. **Phase 2**: Fine-tune thresholds based on performance metrics  
3. **Phase 3**: Optimize constraints for your specific use case

---

*This implementation follows modern bundling best practices and leverages Context7-enhanced documentation for optimal chunk merging strategies.*


