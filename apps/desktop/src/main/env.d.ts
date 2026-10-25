/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly PUBLIC_AWCMS_BACKEND?: string;
  readonly PUBLIC_AWCMS_API_BASE_URL?: string;
  readonly PUBLIC_AWCMS_STOREFRONT_ORIGIN?: string;
  readonly PUBLIC_AWCMS_TENANT_ID?: string;
  readonly PUBLIC_AWCMS_LOCALE?: string;
  readonly PUBLIC_AWCMS_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
