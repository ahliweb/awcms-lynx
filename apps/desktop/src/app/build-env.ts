import type { RuntimeConfig } from '@awcms-lynx/platform';

/**
 * Build-time defaults, inlined from `PUBLIC_AWCMS_*` by Rsbuild. Every value
 * here ends up in an app bundle anyone can unpack: never put a secret in a
 * `PUBLIC_` variable (docs/security.md). The desktop app has no `globalProps`
 * override at runtime other than what src/main/host-config.ts passes, which
 * is the same set of build-time values.
 */
export const BUILD_DEFAULTS: Partial<RuntimeConfig> = {
  backend:
    (import.meta.env.PUBLIC_AWCMS_BACKEND as RuntimeConfig['backend'] | undefined) ?? 'awcms-one',
  apiBaseUrl: import.meta.env.PUBLIC_AWCMS_API_BASE_URL ?? 'http://localhost:4321',
  storefrontOrigin: import.meta.env.PUBLIC_AWCMS_STOREFRONT_ORIGIN || null,
  tenantId: import.meta.env.PUBLIC_AWCMS_TENANT_ID || null,
  locale: import.meta.env.PUBLIC_AWCMS_LOCALE === 'en' ? 'en' : 'id',
  appName: import.meta.env.PUBLIC_AWCMS_APP_NAME ?? 'AWCMS Lynx',
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
};
