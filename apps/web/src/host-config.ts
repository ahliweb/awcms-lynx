/**
 * Pure helpers that turn the build-time `PUBLIC_AWCMS_*` values into what the
 * page hands to `<lynx-view>`. Kept free of the DOM so they unit-test under
 * `bun test`.
 */

export interface HostEnv {
  PUBLIC_AWCMS_BACKEND?: string;
  PUBLIC_AWCMS_API_BASE_URL?: string;
  PUBLIC_AWCMS_STOREFRONT_ORIGIN?: string;
  PUBLIC_AWCMS_TENANT_ID?: string;
  PUBLIC_AWCMS_LOCALE?: string;
  PUBLIC_AWCMS_APP_NAME?: string;
  PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE?: string;
}

export type GlobalProps = Partial<
  Record<'backend' | 'apiBaseUrl' | 'storefrontOrigin' | 'tenantId' | 'locale' | 'appName', string>
>;

function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * `globalProps` for `<lynx-view>`, keyed like `RuntimeConfig`. Only defined,
 * non-empty values are included so the bundle's own defaults still apply to
 * the rest.
 *
 * `apiBaseUrl` (and, for the customer backend, `storefrontOrigin`) default to
 * the page's own origin: awcms staff routes send no CORS headers, so the
 * browser can only reach the backend through a same-origin reverse proxy
 * (apps/web/README.md). Pass `pageOrigin` as `location.origin`.
 */
export function buildGlobalProps(env: HostEnv, pageOrigin?: string): GlobalProps {
  const backend = value(env.PUBLIC_AWCMS_BACKEND);
  const entries: [keyof GlobalProps, string | undefined][] = [
    ['backend', backend],
    ['apiBaseUrl', value(env.PUBLIC_AWCMS_API_BASE_URL) ?? pageOrigin],
    [
      'storefrontOrigin',
      value(env.PUBLIC_AWCMS_STOREFRONT_ORIGIN) ?? (backend === 'awcms' ? undefined : pageOrigin),
    ],
    ['tenantId', value(env.PUBLIC_AWCMS_TENANT_ID)],
    ['locale', value(env.PUBLIC_AWCMS_LOCALE)],
    ['appName', value(env.PUBLIC_AWCMS_APP_NAME)],
  ];
  const props: GlobalProps = {};
  for (const [key, entry] of entries) {
    if (entry !== undefined) props[key] = entry;
  }
  return props;
}

/**
 * Staff sessions (`awcms`) end with the tab (`session`); customer sessions
 * (`awcms-one`, the default backend) survive it (`local`). An explicit
 * `PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE` of `local` or `session` wins.
 */
export function resolvePersistence(env: HostEnv): 'local' | 'session' {
  const explicit = value(env.PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE);
  if (explicit === 'local' || explicit === 'session') return explicit;
  return value(env.PUBLIC_AWCMS_BACKEND) === 'awcms' ? 'session' : 'local';
}

/** `<html lang>` value: the two locales the app ships, `id` by default. */
export function resolveHtmlLang(locale: string | undefined): 'en' | 'id' {
  return value(locale) === 'en' ? 'en' : 'id';
}
