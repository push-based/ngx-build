---
sidebar_position: 1
---

# Angular CLI setup

Angular CLI projects need a builder that exposes Angular's esbuild plugin list. Angular's built-in `application` builder uses esbuild, but it does not provide a public `plugins` option.

Use the `@angular-builders/custom-esbuild:application` builder from [`@angular-builders/custom-esbuild`](https://github.com/just-jeb/angular-builders/tree/master/packages/custom-esbuild#custom-esbuild-application). It extends Angular's `application` builder and adds a `plugins` option for esbuild plugins.

At a high level, the setup is:

1. Install the chunk optimizer package and the custom esbuild builder.
2. Change the application's `build` target to `@angular-builders/custom-esbuild:application`.
3. Add a small esbuild plugin file that imports and exports the chunk optimizer.
4. Register that plugin file in the build target's `plugins` array.

Install the packages:

```bash
npm install --save-dev @angular-builders/custom-esbuild
npm install @push-based/ngx-chunks
```

Update the application build target in `angular.json`.

```json title="angular.json"
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-builders/custom-esbuild:application",
          "options": {
            "plugins": ["@push-based/ngx-chunks"],
             // other options
          }
        }
      }
    }
  }
}
```

@TODO add link to advance configuration
