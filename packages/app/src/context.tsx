import type { AwcmsClient } from '@awcms-lynx/client';
import type { AppInfo, HostBridge, RuntimeConfig } from '@awcms-lynx/platform';
import { createContext, useContext } from '@lynx-js/react';
import type { Translate } from './i18n.ts';

export interface AppServices {
  config: RuntimeConfig;
  client: AwcmsClient;
  bridge: HostBridge;
  appInfo: AppInfo | null;
  t: Translate;
}

const AppContext = createContext<AppServices | null>(null);

export const AppProvider = AppContext.Provider;

export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('useApp() must be used inside <AppProvider>');
  return services;
}
