/**
 * What the main process hands the Lynx page as `lynx.__globalProps`, and the
 * window title. Lynxtron 0.0.30 accepts `globalProps` in `loadFile` / `loadURL`
 * (apis/api/lynx-window.d.ts), so it is wired; the values are the same
 * build-time `PUBLIC_AWCMS_*` defaults the UI bundle already carries. They are
 * not user-editable at runtime on purpose (see README).
 */
export const DEFAULT_APP_NAME = 'AWCMS Lynx';

export function buildGlobalProps(env: {
  backend?: string;
  apiBaseUrl?: string;
  storefrontOrigin?: string;
  tenantId?: string;
  locale?: string;
  appName?: string;
}): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, raw] of Object.entries(env)) {
    const value = raw?.trim();
    if (value) props[key] = value;
  }
  return props;
}

export function windowTitle(appName: string | undefined): string {
  return appName?.trim() || DEFAULT_APP_NAME;
}
