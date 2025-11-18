# NgxBuild

Tools to optimize build outputs from Angular when using Esbuild.

https://repl.rolldown.rs/#eNqNUsFugzAM/RUrF1qpgjsVu2y7Taq0TdqllwhMly01KDEdFeLf57SEtds0DRDBid97xn6DqlU+KCR2x/TNh29S+Ve8UqWEZt82jmHoR6hds4ckzSrNWhKSLZUN+cZiapvdol9uaUvn9EXIOpLemzIkLtdChipn1+G4Uq6xtmo+KBV4bXYpz9q/nFxVwccWYYDHKW3TspEKIJYW4ck6lIL9CVNhrTvLsBhAtwbGZf4DX9zAEBAADrlzFCKQy1DbcQ5JbEmyOu+3Dj26A96H/SezIy0o9DnU2nqckkQendkLVts8MgJ4dqbk+x7LLohvXIUuh9CZCTdOa9PxSX1GZpmuDppKrG5fO3oXufkoHBoqbVfhHbZIFVJp0D+KiPPmgPZ4JRHSo8wYFnnJs6Usg2fTCrN0KjVC00f+oihAf2jDECc8N1vmLrjzFXCXP/4HLrvMCyRKrDFZK/ohhmcTTAMNpmPooYDkZfMgdxj3tRPXJ67ZgDPd184/zP2dVI1CehCU1Yye1fgJOTMWYg==

https://esbuild.github.io/try/#YgAwLjI1LjExAHsKICBidW5kbGU6IHRydWUsCiAgZm9ybWF0OiAnZXNtJywKICBzcGxpdHRpbmc6IHRydWUsCiAgb3V0ZGlyOiAnLycsCn0AZQBlbnRyeS5qcwBpbXBvcnQge3h9IGZyb20gJy4vZGF0YS5qcycKY29uc29sZS5sb2coeCkKCmltcG9ydCgnLi9keW5hbWljLmpzJykAAGR5bmFtaWMuanMAaW1wb3J0IHt4fSBmcm9tICcuL2RhdGEuanMnCgpjb25zb2xlLmxvZyh4KQAAZGF0YS5qcwBleHBvcnQgY29uc3QgeCA9ICdXT0xPTE8nOw

### Reachability strategy

The reachability strategy attempts to optimize the bundle as much as possible without any significant increase in bundle size.

It does this by traversing the imports and merging chunks based on the paths from which the code is reachable.

#### Motivation

The Esbuild chunking algorithm considers each dynamic entry point, as its own entry point. Because it does not
distinguish between entry points, it will optimize each entry point to reduce the amount of code required to load that
entry point.

```mermaid
graph TD
    main
    dynamic
    shared
    
    main --> shared
    dynamic --> shared
    main -.-> dynamic
```
TODO add visual

However, in the context of single page applications like angular, there is only one entry point and the rest of the
dynamic entry points cannot load or function outside that context. This means that we do not need to optimize for each
entry point but instead optimize for the entry points considering only there reachability from the main entry point.

TODO add visual

```mermaid
graph TD
    main
    dynamic
    shared

    subgraph G1["main"]
        main
        shared
    end

    subgraph G2["dynamic"]
        dynamic
    end

    G1 -.-> G2
    G2 --> G1
```

### Transpiled TS-JS

#### Transpiled Source

```ts
// main.ts
import('./dynamic1');
import('./dynamic2');
import('./dynamic3');

// dynamic1.ts
import './static1';
import './static2';
import './static3';

// dynamic2.ts
import './static1';
import './static2';
import './static3';

// dynamic3.ts
import './static1';
import './static2';
import './static4';
```

#### Transpiled Output 

```mermaid
graph TD
    main.ts
    dynamic1.ts
    dynamic2.ts
    dynamic3.ts
    static1.ts
    static2.ts
    static3.ts
    static4.ts

    subgraph main.js
        main.ts
    end
    subgraph dynamic1.js
        dynamic1.ts
    end
    subgraph dynamic2.js
        dynamic2.ts
    end
    subgraph dynamic3.js
        dynamic3.ts
    end
    subgraph static1.js
        static1.ts
    end
    subgraph static2.js
        static2.ts
    end
    subgraph static3.js
        static3.ts
    end
    subgraph static4.js
        static4.ts
    end

    main.js -.-> dynamic1.js
    main.js -.-> dynamic2.js
    main.js -.-> dynamic3.js

    dynamic1.js --> static1.js
    dynamic1.js --> static2.js
    dynamic1.js --> static3.js

    dynamic2.js --> static1.js
    dynamic2.js --> static2.js
    dynamic2.js --> static3.js

    dynamic3.js --> static1.js
    dynamic3.js --> static2.js
    dynamic3.js --> static4.js
```

### `include` property

The include property can be used to explicitly pull certain imports into a shared “bucket” (entry-point group), e.g. common. This is useful for shared code that should live in a dedicated chunk instead of being duplicated across multiple dynamic entry points.

#### Include Types

```ts

export type IncudeStrategy = |
  // optimize bundling per view / route
  | 'withSharedDeps' // The static imports of the files which are the same as all the bundles with the same name
  | 'withAllDeps'; // The static imports of the files regardless of if they are shared by other bundle with the same name

extends type IncludesAttributeOptions = {
  /**
   * Registers the imported file into a map that will allow pointing the them externally
   * bundle-optimization-map.json
   * {
   *   "sports-root-route": {
   *    "inputFile": "sports.ts"
   *    "outputFile": "sports-XXXXXX.js"
   *   }
   * }
   * 
   * This will make it easier to reference imports post bundling by using a tag instead of seaching for them via the 
   * esbuild stats json with a mapped output path.
   * Additionally it can be used for preloading or getting the reference of the feature
   * There can only be one tag per output path
   */
  entryPointTag?: string; // Shortend to reference an entry point (used later on future optimizations) TODO reference them
  chunkName?: string; // slug of the bundle this import and/or its deps should end up in
  include?: IncudeStrategy, // defaults to withSharedDeps
};
```

#### Include Source V1

```ts
// main.ts
import('./dynamic1', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common" } });
import('./dynamic2', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common" } });
import('./dynamic3', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common" } });

// dynamic1.ts
import './static1';
import './static2';
import './static3';

// dynamic2.ts
import './static1';
import './static2';
import './static3';

// dynamic3.ts
import './static1';
import './static2';
import './static4';
```

#### Include Output V1

```mermaid
graph TD
    main.ts
    dynamic1.ts
    dynamic2.ts
    dynamic3.ts
    static1.ts
    static2.ts
    static3.ts
    static4.ts

    subgraph main.js
        main.ts
    end
    subgraph dynamic1.js
        dynamic1.ts
    end
    subgraph dynamic2.js
        dynamic2.ts
    end
    subgraph dynamic3.js
        dynamic3.ts
    end
    subgraph static4.js
        static4.ts
    end
    
    subgraph common.js
        static1.ts
        static2.ts
        static3.ts
    end

    main.js -.-> dynamic1.js
    main.js -.-> dynamic2.js
    main.js -.-> dynamic3.js

    dynamic1.js --> common.js

    dynamic2.js --> common.js

    dynamic3.js --> common.js
    dynamic3.js --> static4.js
```

#### Include Source V2

TODO explain use case for 'withAllDeps';
```ts
// main.ts
import('./dynamic1', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common" } });
import('./dynamic2', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common",  "include": "withAllDeps"} });
import('./dynamic3', { "with": { "entryPointTag": "EntryPointMapKey", "chunkName": "common" } });

// dynamic1.ts
import './static1';
import './static2';
import './static3';

// dynamic2.ts
import './static1';
import './static2';
import './static3';

// dynamic3.ts
import './static1';
import './static2';
import './static4';
```

#### Include Output V2

```mermaid
graph TD
    main.ts
    dynamic1.ts
    dynamic2.ts
    dynamic3.ts
    static1.ts
    static2.ts
    static3.ts
    static4.ts

    subgraph main.js
        main.ts
    end
    subgraph dynamic1.js
        dynamic1.ts
    end
    subgraph dynamic2.js
        dynamic2.ts
    end
    subgraph dynamic3.js
        dynamic3.ts
        
    end
    subgraph static3.js
        static3.ts
    end
    subgraph static4.js
        static4.ts
    end
    
    subgraph common.js
        static1.ts
        static2.ts
        static3.ts
    end

    main.js -.-> dynamic1.js
    main.js -.-> dynamic2.js
    main.js -.-> dynamic3.js

    dynamic1.js --> common.js

    dynamic2.js --> common.js
    dynamic2.js --> static3.js

    dynamic3.js --> common.js
    dynamic3.js --> static4.js
```


#### Include Output


```mermaid
graph TD
    main.ts
    dynamic1.ts
    dynamic2.ts
    dynamic3.ts
    static1.ts
    static2.ts
    static3.ts
    static4.ts

    subgraph main.js
        main.ts
    end
    subgraph dynamic1.js
        dynamic1.ts
    end
    subgraph dynamic2.js
        dynamic2.ts
    end
    subgraph dynamic3.js
        dynamic3.ts
        
    end
    subgraph static3.js
        static3.ts
    end
    subgraph static4.js
        static4.ts
    end
    
    subgraph common.js
        static1.ts
        static2.ts
        static3.ts
    end

    main.js -.-> dynamic1.js
    main.js -.-> dynamic2.js
    main.js -.-> dynamic3.js

    dynamic1.js --> common.js

    dynamic2.js --> common.js
    dynamic2.js --> static3.js

    dynamic3.js --> common.js
    dynamic3.js --> static4.js
```

### `exclude` property**

The exclude property does the opposite of include: it prevents an import from being pulled into a given shared entry-point group, even if it would normally qualify (for example, because it’s imported from multiple dynamic entry points).

This is useful when some imports are shared but should still remain “local” to their entry point (e.g. feature-specific code), while other imports go to a common chunk.


#### Exclude Types

```ts
export type ExcludeStrategy = |
  // optimize bundling per view / route
  'withDeps' // The direct static imports of the file, not its children
  | 'withStartupDeps' // The static imports of the file including its children
  | 'withAllDeps'; // The static and dynamic imports of the file including its children

extends type ExcludeAttributeOptions = {
  exclude: ExcludeStrategy,
};
```

#### Exclude Source

```ts
// main.ts
// main.ts
import('./dynamic1');
import('./dynamic2');

// dynamic1.ts
import './shared1' with { "tag": "EntryPointMapKey", "include": "common" }
import './shared2';
import './static1';

// dynamic2.ts
import './shared1' with { "tag": "EntryPointMapKey", "include": "common" }
import './shared2' with { "tag": "EntryPointMapKey", "include": "common" }
import './static2';
```

#### Exclude Output

```mermaid
graph TD
    main.ts
    dynamic1.ts
    dynamic2.ts
    shared1.ts
    shared2.ts
    static1.ts
    static2.ts

    subgraph main.js
        main.ts
    end
    subgraph dynamic1.js
        dynamic1.ts
    end
    subgraph dynamic2.js
        dynamic2.ts
    end
    subgraph common.js
        shared1.ts
        shared2.ts
    end
    subgraph static1.js
        static1.ts
    end
    subgraph static2.js
        static2.ts
    end

    main.js -.-> dynamic1.js
    main.js -.-> dynamic2.js

    dynamic1.js --> common.js
    dynamic2.js --> common.js

    dynamic1.js --> static1.js
    dynamic2.js --> static2.js
```


#### Rolldown considerations

This is achievable with rolldown and would usually be the default behaviour. However, there are a couple caviates and
configurations that would have to be used.

TODO explain the config and why its necessary

Yet, this still does not work when rebundling an angular application, because of that we require analyzing the module
graph ourselves and create an advance chunking strategy based on this strategy.

### Bundlers 
TODO baseline documation on bundlers 

### Document bundle issues 
TODO
- Chunk size
- Single chunk
- bundling vs transpailing 
- bundling performance 
- typechecking


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
