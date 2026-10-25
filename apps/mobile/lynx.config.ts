import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

/**
 * One source, two artifacts:
 *
 *   dist/main.lynx.bundle — loaded by the iOS, Android and HarmonyOS hosts
 *                           (hosts/) and by Lynx Explorer during development.
 *   dist/main.web.bundle  — mounted by apps/web through <lynx-view>.
 *
 * `PUBLIC_AWCMS_*` variables from `.env`, `.env.<mode>` or the process
 * environment are inlined as `import.meta.env.*` (Rsbuild env loading,
 * enabled by Rspeedy by default) — see src/build-env.ts and .env.example.
 */
export default defineConfig({
  source: {
    entry: { main: './src/index.tsx' },
  },
  plugins: [
    pluginQRCode({
      schema(url) {
        // `?fullscreen=true` opens the page full screen in Lynx Explorer.
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx(),
    pluginTypeCheck(),
  ],
  environments: {
    lynx: {},
    web: {},
  },
});
