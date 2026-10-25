/**
 * Lynxtron main process: one LynxWindow that runs main.lynx.bundle and answers
 * the host-bridge contract from `-lynx-invoke`.
 *
 * There is deliberately no preload script. A preload could expose Node or
 * Lynxtron APIs to the UI (`NativeModules.nodejs`); this app needs none, so
 * the UI's only way out of its sandbox is `NativeModules.bridge.call` with the
 * five validated methods in host.ts (least privilege).
 */
import path from 'node:path';
import { app, LynxWindow, shell } from '@lynx-js/lynxtron';
import { createDesktopHostHandler } from './host.ts';
import { buildGlobalProps, windowTitle } from './host-config.ts';
import { FileSecretStore } from './secret-store.ts';

const isDev = process.env.NODE_ENV === 'development';
const DEV_BUNDLE_URL = 'http://localhost:5969/main.lynx.bundle';

const APP_NAME = windowTitle(import.meta.env.PUBLIC_AWCMS_APP_NAME);
const APP_ID = 'id.ahliweb.awcms.lynx';

const globalProps = buildGlobalProps({
  backend: import.meta.env.PUBLIC_AWCMS_BACKEND,
  apiBaseUrl: import.meta.env.PUBLIC_AWCMS_API_BASE_URL,
  storefrontOrigin: import.meta.env.PUBLIC_AWCMS_STOREFRONT_ORIGIN,
  tenantId: import.meta.env.PUBLIC_AWCMS_TENANT_ID,
  locale: import.meta.env.PUBLIC_AWCMS_LOCALE,
  appName: import.meta.env.PUBLIC_AWCMS_APP_NAME,
});

function createWindow(host: ReturnType<typeof createDesktopHostHandler>): LynxWindow {
  const window = new LynxWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: APP_NAME,
  });

  // The UI calls NativeModules.bridge.call(method, params, callback); the
  // value passed to sendReply becomes the callback argument.
  window.on('-lynx-invoke', async (event, method, params) => {
    event.sendReply(await host(method, params));
  });

  window.show();
  if (isDev) {
    window.loadURL(DEV_BUNDLE_URL, { globalProps });
  } else {
    window.loadFile(path.join(__dirname, 'main.lynx.bundle'), { globalProps });
  }
  return window;
}

// A stable per-user data directory named after the app id (not the package name,
// which would create `@awcms-lynx/desktop`). Must run before the single-instance
// lock and before `ready`, because both use it.
app.setPath('userData', path.join(app.getPath('appData'), APP_ID));

// One instance per user: two instances would race on the secret store file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);

  app.whenReady().then(() => {
    const host = createDesktopHostHandler({
      store: new FileSecretStore(path.join(app.getPath('userData'), 'secure-storage.json')),
      appVersion: app.getVersion(),
      openExternal: async (url) => {
        await shell.openExternal(url);
        return true;
      },
    });

    let window = createWindow(host);

    app.on('second-instance', () => {
      if (window.isMinimized()) window.restore();
      window.focus();
    });
    // macOS keeps the app alive without windows; the dock icon opens a new one.
    app.on('activate', () => {
      if (LynxWindow.getAllWindows().length === 0) window = createWindow(host);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
