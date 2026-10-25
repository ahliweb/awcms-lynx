/// <reference types="@rsbuild/core/types" />

/** Build-time values the host page is configured with (see apps/web/.env.example). */
interface ImportMetaEnv {
  readonly PUBLIC_AWCMS_BACKEND?: string;
  readonly PUBLIC_AWCMS_API_BASE_URL?: string;
  readonly PUBLIC_AWCMS_STOREFRONT_ORIGIN?: string;
  readonly PUBLIC_AWCMS_TENANT_ID?: string;
  readonly PUBLIC_AWCMS_LOCALE?: string;
  readonly PUBLIC_AWCMS_APP_NAME?: string;
  readonly PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Replaced at build time with apps/web/package.json "version". */
declare const __APP_VERSION__: string;
