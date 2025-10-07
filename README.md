# NgxBuild

Tools to optimize build outputs from Angular when using Esbuild.

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

