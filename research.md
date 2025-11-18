## Research

### Query imports
Query via import attributes (TODO explain)

### Simulation

### Investigate QWIK Bundle strategies
https://qwik.dev/

### Issue and knowledge base list

| Idea                                                         | Number of Bundles | Bundle Size | Build Time | Caching | Maintainability | DX (Configurability) | Notes / Explanation                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ----------------- | ----------- | ---------- | ------- | --------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merging bootstrap imports into main (or by reachability)** | ++                | ++          | +          | --      | -               | +                    | Great for merging early bootstrap deps and reducing chunk count. Increases cache busting because main bundle changes more often. Slightly harder long-term maintenance because of tighter coupling.                                                                     |
| **Import Attributes**                                        | 0                 | 0           | +          | +       | +               | ++                   | Mostly neutral for bundles, but improves clarity of static/server config. Helpful for SSR/CSR divergence flags. Very high DX because config becomes explicit.                                                                                                           |
| **Pre-bundling libs**                                        | +                 | +           | ++         | -       | -               | +                    | Tremendously speeds up incremental + cold builds by avoiding repeated transforms. But requires a dependency graph upfront (e.g., lockfile hashing). Maintenance cost because pre-bundle must be kept in sync.                                                           |
| **Dynamic entry-point merging**                              | ++                | +           | -          | --      | --              | -                    | Removes the limitation of “1 chunk per dynamic import”, allowing smarter merging by heuristics. But requires multi-layer bundling pipelines, complex logic, and causes cache ripple effects when dynamic entrypoints merge/split. Lower DX due to debugging complexity. |

### Cache persistance

Spliting the main outside of its self and treating it as external will allow it to be cached across entry points (main.js, sports.js)


- Merging bootstrap imports into main (Or by Reachability)
  **Impact**
  Reduce bundle chunks
  Reduce bundle size

**Problems**
Increase cache invalidation

- Import Attributes

```json-c
{ 
    "with": { 
      "tag": "EntryPointMapKey", # Adds an entry to the optimized bundle to allow referencing by tag name instead of input
    }
},
{ 
    "with": { 
      "tag": "EntryPointMapKey",
      "bundle": "common", # File pulled from this entry point will be bundle into a bundle with the name of the key
      "target": "entry" 
    }
},
{ 
    "with": { 
      "tag": "EntryPointMapKey",
      "bundle": "common",
      "target": "imports" 
    }
},
{ 
    "with": { 
      "tag": "EntryPointMapKey",
      "bundle": "common", # File pulled from this entry point will be bundle into a bundle with the name of the key
    }
},
# TODO example
{
    "with": { 
      "tag": "EntryPointMapKey",
      "strategy": "excluded-common", # Excluded from common bundle
    }
},
# Ask Voito about magic comments
{
    "with": { 
      "tag": "EntryPointMapKey",
      "strategy": "preload", # Adds a preload tag to index.html
      "fetch-priority": "high"
    }
}
```

**Impact**
Simplify static config

**Problems**


- Pre-bundling libs

**Impact**
Reduce build time

**Problems**
Requires pre-computing dependency tree


- Dynamic Entry point merging

**Impact**
Removes limitation of one chunk per dynamic import

**Problem**
Requires multiple layers of bundling

- Preload Module Map

Use the import attributes ot generate a map of assets which can be used to make some smart preloading

The import map would collect the list of features and assets making them available as a map so that we can manually import them at runtime to do some smart preloading.
This could also be done on the server to add the features directly on the HTML as a preload tag.

- Typesafe by extending global scope
  We can likely extend the type of import attributes to make it more type safe and give autocomplete by extending the global scope.
  Consider reviewing the example of ts-reset
