/**
 * Lynx for Web host page.
 *
 * Mounts one full-viewport `<lynx-view>` on the shared `main.web.bundle` and
 * answers the host-bridge contract (packages/platform/src/contract.ts) from
 * the page's main thread. All UI lives in the ReactLynx bundle (packages/app);
 * this file only configures the host.
 */
import '@lynx-js/web-core/client';
import { createWebHostHandler } from '@awcms-lynx/platform/web-host';
import type { LynxViewElement } from '@lynx-js/web-core/client';
import { buildGlobalProps, type HostEnv, resolvePersistence } from './host-config.ts';

const env: HostEnv = {
  PUBLIC_AWCMS_BACKEND: import.meta.env.PUBLIC_AWCMS_BACKEND,
  PUBLIC_AWCMS_API_BASE_URL: import.meta.env.PUBLIC_AWCMS_API_BASE_URL,
  PUBLIC_AWCMS_STOREFRONT_ORIGIN: import.meta.env.PUBLIC_AWCMS_STOREFRONT_ORIGIN,
  PUBLIC_AWCMS_TENANT_ID: import.meta.env.PUBLIC_AWCMS_TENANT_ID,
  PUBLIC_AWCMS_LOCALE: import.meta.env.PUBLIC_AWCMS_LOCALE,
  PUBLIC_AWCMS_APP_NAME: import.meta.env.PUBLIC_AWCMS_APP_NAME,
  PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE: import.meta.env.PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE,
};

const BUNDLE_URL = '/main.web.bundle';

const view = document.createElement('lynx-view') as LynxViewElement;
view.id = 'awcms-lynx-root';

// Ordering matters: the bundle starts loading as soon as `url` is set on a
// connected element, and `globalProps` / the native-module handler must
// already be in place by then, or the app would read an empty config.
view.globalProps = buildGlobalProps(env, window.location.origin);
view.onNativeModulesCall = createWebHostHandler({
  persistence: resolvePersistence(env),
  appVersion: __APP_VERSION__,
});
view.addEventListener('error', (event: Event) => {
  console.error('[awcms-lynx] Lynx error', (event as unknown as CustomEvent).detail);
});
view.url = BUNDLE_URL;

document.getElementById('root')?.replaceChildren(view);
