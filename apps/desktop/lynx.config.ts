import { pluginRspeedyDevReady } from '@lynx-js/lynxtron-dev-plugins/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

/**
 * Builds the ReactLynx UI for Lynxtron: output/bundle/lynx/main.lynx.bundle.
 * `rsbuild.config.ts` copies it next to the main process into dist/desktop.
 *
 * The same `@awcms-lynx/app` code runs on every host, so this config
 * deliberately matches apps/mobile (no desktop-only CSS or event switches).
 * If a derived app wants Lynxtron's W3C mouse events or CSS inheritance, add
 * `pluginLynxConfig` from `@lynx-js/config-rsbuild-plugin` as the Lynxtron
 * scaffold does, and test the shared screens again.
 */
export default defineConfig({
  server: {
    // The main process loads http://localhost:5969/main.lynx.bundle in development.
    port: 5969,
  },
  source: {
    entry: { main: './src/app/index.tsx' },
  },
  output: {
    filename: '[name].[platform].bundle',
    distPath: { root: './output/bundle/lynx' },
  },
  plugins: [pluginReactLynx(), pluginTypeCheck(), pluginRspeedyDevReady()],
  environments: {
    lynx: {},
  },
});
