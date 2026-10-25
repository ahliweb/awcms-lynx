import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rsbuild';
import { defineConfig } from '@rsbuild/core';

/**
 * Builds the Lynxtron main process into dist/desktop and copies the Lynx
 * bundle that `rspeedy build` produced (output/bundle/lynx) next to it.
 * There is only a `desktop` environment: the browser build is apps/web.
 *
 * Everything the main process imports is bundled (workspace packages are
 * devDependencies on purpose: pluginLynxtron keeps `dependencies` external).
 */
export default defineConfig({
  environments: {
    desktop: {
      source: {
        entry: { main: './src/main/main.ts' },
      },
      plugins: [pluginLynxtron({ args: ['--inspect=9222'] })],
      output: {
        target: 'node',
        distPath: { root: './dist/desktop' },
        copy: [
          { from: './package.json', to: 'package.json' },
          { from: './output/bundle/lynx/', to: '.' },
        ],
      },
      dev: {
        writeToDisk: true,
      },
    },
  },
});
