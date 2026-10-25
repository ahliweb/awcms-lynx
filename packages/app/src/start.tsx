import {
  createHostBridge,
  type RuntimeConfig,
  RuntimeConfigError,
  resolveRuntimeConfig,
} from '@awcms-lynx/platform';
import { root } from '@lynx-js/react';
import { AwcmsApp, ConfigErrorScreen } from './App.tsx';

/**
 * The single entry every bundle calls (apps/mobile for iOS/Android/HarmonyOS
 * and Web, apps/desktop for Lynxtron). `defaults` are the build-time
 * `PUBLIC_AWCMS_*` values; the host's `lynx.__globalProps` override them.
 */
export function startApp(defaults: Partial<RuntimeConfig>) {
  const globalProps = typeof lynx === 'undefined' ? undefined : lynx.__globalProps;
  let config: RuntimeConfig;
  try {
    config = resolveRuntimeConfig(defaults, globalProps);
  } catch (error) {
    const message = error instanceof RuntimeConfigError ? error.message : String(error);
    root.render(
      <ConfigErrorScreen message={message} locale={defaults.locale === 'en' ? 'en' : 'id'} />,
    );
    return;
  }
  root.render(<AwcmsApp config={config} bridge={createHostBridge()} />);
}
