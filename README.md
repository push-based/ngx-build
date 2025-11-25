# NgxBuild

Tools to optimize build outputs from Angular when using Esbuild.

## Motivation

### Problem Statement

The Angular CLI is in the migrating from [Webpack](https://webpack.js.org/) to [Esbuild](https://esbuild.github.io/), 
this has brought some massive build time performance improvements but also 
[runtime performance degradations on large project](https://github.com/angular/angular-cli/issues/27321). 
The root cause of this is the 
[esbuild code splitting algorithm](https://github.com/evanw/esbuild/blob/main/docs/architecture.md#code-splitting), 
which focus on minimizing the amount of code required by any entry point of the application. The problem is that the
algorithm does not take into account additional consideration such as entry point hierarchy or application specific
aspects like configurations which impact loading. Additionally, there is no API to configure code splitting behaviour in
esbuild.

To address some of these issues the angular team has added the 
[experimental chunk optimizer](https://github.com/angular/angular-cli/pull/27953), which rebundles the application 
with rolldown to reduce the number of bundle. This can already significantly impact the amount of chunks in you 
application especially for the initial bundles. However, this solution is limited and does not allow itself to be 
extended with additional configuration to optimize.

This is a TL;DR of the problem, if you would like to get a deeper understanding of this issue consult the 
[docs](./problem-statements.md)

### Solution

A set of tools that allows users to optimize the bundle output of angular application beyond the angular experimental 
chunk optimizer. By default, it provides additional optimization which most apps can benefit from, however, it is also
configurable allowing for more complex optimizations which cannot be generalized to all applications.

### Impact

It is hard to quantify the general impact of reducing the number of chunks inside an application. 
@TODO add precedents and external information. 

Additionally, we created a demo that allows us to get more precise data on the impact of reducing chunks using the
defaults

@TODO Explain outcome
https://github.com/angular/angular-cli/issues/27715#issuecomment-3398232305

## Usage

@Michael TODO review setup instruction

As of now the bundle optimizer is only available for NX, however, we plan to make it more accessible for users that 
with setups.

TODO specify configuration and configuration defaults

### Usage with NX

To use the bundle optimizer you can install the npm package inside the repository

```
npm install @rx-angular/ngx-chunks
```

It is exposed as an Esbuild Plugin allowing you to simply add it to your build target in NX:

```json
{
  "build": {
    "executor": "@nx/angular:application",
    "options": {
      "plugins": ["@ngx-build/esbuild-plugin"]
    }
  }
}
```

Additionally, you can specify additional configuration options inside the plugin options

```json
{
  "build": {
    "executor": "@nx/angular:application",
    "options": {
      "plugins": [
        {
          "path": "@ngx-build/esbuild-plugin",
          "options": {} // TODO specify config options
        }
      ]
    }
  }
}
```

## Architecture 

@TODO 
Mini explanation and link to md with details

## Contributing

@TODO

--- 
@TODO most likely everything down from here can be removed.
---

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

#### Rolldown considerations

This is achievable with rolldown and would usually be the default behaviour. However, there are a couple caviates and
configurations that would have to be used. 

TODO explain the config and why its necessary

Yet, this still does not work when rebundling an angular application, because of that we require analyzing the module
graph ourselves and create an advance chunking strategy based on this strategy.


## Usage

> [!IMPORTANT]
> This is still not published, we hope that we don't need to and angular will integrate something into the new build 
> system. This is already in progress with the experimental chunk optimizer:
> [`NG_BUILD_OPTIMIZE_CHUNKS=1`](https://github.com/angular/angular-cli/pull/27953)

It is currently exposed as an Esbuild Plugin allowing you to simply add it to you build target in NX and optionally
specify the number of chunks you would like to output:

```json
{
  "build": {
    "executor": "@nx/angular:application",
    "options": {
      "plugins": ["@ngx-build/esbuild-plugin"]
    }
  }
}
```

By default, we optimize produce 6 initial chunks as use a greedy algorithm to make them approximately the same size. 
However, if you want to specify the number of chunks you would it to output you can pass it to the plugin:

```json
{
  "build": {
    "executor": "@nx/angular:application",
    "options": {
      "plugins": [
        {
          "path": "@ngx-build/esbuild-plugin",
          "options": {
            "maxChunks": 3
          }
        }
      ]
    }
  }
}
```

## Optimizing Initial Chunks

When migrating to [Angular's new Build System](https://angular.dev/tools/cli/build-system-migration) you might have 
noticed that there is a significant difference in the initial chunks. 

While Webpack originally bundled the initial chunks into a couple of named chunks: 

- main.ts
- runtime.ts
- vendor.ts
- polyfills.ts

Esbuild on the other hand does not work in the same was and will many more initial unnamed chunks: 

- main.ts
- polyfills.ts
- chunk.1.ts
- chunk.2.ts
- chunk.3.ts
- ...

It is important to recognize this is not an issue for most application and is only a problem when you have a very large
and dynamic application. The issue comes when what use to be 3 or 4 files has now become 200 files, all necessary to 
bootstrap the application. This will cause a performance degradation for the initial user experience, which we like to 
refer to as `The Chunk Gap`.

The degradation in performance is most likely caused by `network thrashing` as both the server and client are being
overwhelmed with excessive requests. And even tho HTTP/2 and HTTP/3 have a massive advantage over HTTP 1.1 we can 
still see a clear degradation.

### Additional Information

We are working on extending the docs, in the meantime here are some resources which might be helpful:

- [refactor(@angular/build): add experimental chunk optimizer for production application builds](https://github.com/angular/angular-cli/pull/27953)
- [Creating unnecessary excessive chunks](https://github.com/angular/angular-cli/issues/27715)
- [Code splitting is creating many small unnecessary chunks](https://github.com/evanw/esbuild/issues/3780)
- [Degraded Web Vitals (LCP, FCP) after switching a universal app to esbuild](https://github.com/angular/angular-cli/issues/27321)
- [application builder generates many initial chunks](https://github.com/angular/angular-cli/issues/26307#issuecomment-1830438109)


-- Compare output states of both bundles and identify where the additional sources are coming from. 

-- Investigate potential issues with js transformer

