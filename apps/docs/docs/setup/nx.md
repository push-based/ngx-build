---
sidebar_position: 3
---

# Nx Workspace Setup

Nx workspaces can use the provided Nx plugin to automate setup.

First add the package to the workspace:

```bash
nx add @push-based/ngx-chunks
```

Then configure an Angular application project:

```bash
nx g @push-based/ngx-chunks:configure --project=my-app
```

The configure generator installs any required dependencies and updates the selected project's build target so the chunk optimizer is registered as an esbuild plugin.

The resulting build target should include the plugin in its `plugins` array:

```json
{
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        "plugins": ["@push-based/rx-chunks"],
        // other options
      }
    }
  }
}
```

@TODO point to advance 
