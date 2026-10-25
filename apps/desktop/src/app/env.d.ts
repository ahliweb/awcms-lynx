/// <reference types="@lynx-js/rspeedy/client" />

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_AWCMS_BACKEND?: string;
    readonly PUBLIC_AWCMS_API_BASE_URL?: string;
    readonly PUBLIC_AWCMS_STOREFRONT_ORIGIN?: string;
    readonly PUBLIC_AWCMS_TENANT_ID?: string;
    readonly PUBLIC_AWCMS_LOCALE?: string;
    readonly PUBLIC_AWCMS_APP_NAME?: string;
  }
}

declare module '@lynx-js/types' {
  /** Keys a host may pass in `globalProps` (packages/platform/src/runtime-config.ts). */
  interface GlobalProps {
    backend?: string;
    apiBaseUrl?: string;
    storefrontOrigin?: string;
    tenantId?: string;
    locale?: string;
    appName?: string;
    environment?: string;
  }
}

export {};
