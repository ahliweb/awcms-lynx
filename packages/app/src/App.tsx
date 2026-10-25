import { type AwcmsClient, createAwcmsClient } from '@awcms-lynx/client';
import {
  type AppInfo,
  type AppLocale,
  createSecureKeyValueStore,
  type HostBridge,
  type RuntimeConfig,
} from '@awcms-lynx/platform';
import { useEffect, useMemo, useState } from '@lynx-js/react';
import { Loading } from './components/Screen.tsx';
import { type Tab, TabBar } from './components/TabBar.tsx';
import { AppProvider, type AppServices } from './context.tsx';
import { createTranslator } from './i18n.ts';
import { AccountScreen } from './screens/AccountScreen.tsx';
import { CatalogScreen } from './screens/CatalogScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { SearchScreen } from './screens/SearchScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import './styles/app.css';

type TabKey = 'home' | 'search' | 'catalog' | 'account' | 'settings';

export const LOCALE_PREFERENCE_KEY = 'awcms-lynx:pref:locale';

export interface AwcmsAppProps {
  config: RuntimeConfig;
  bridge: HostBridge;
  /** Injected by tests; built from `config` + the host's secure storage otherwise. */
  client?: AwcmsClient;
}

/**
 * The application root shared by every target. Boot order: read the host's
 * `app.info`, restore the persisted session and locale preference, then
 * render the tabs for the configured backend.
 */
export function AwcmsApp({ config: baseConfig, bridge, client: injectedClient }: AwcmsAppProps) {
  const [locale, setLocale] = useState<AppLocale>(baseConfig.locale);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('home');

  const config = useMemo(() => ({ ...baseConfig, locale }), [baseConfig, locale]);
  const client = useMemo(
    () => injectedClient ?? createAwcmsClient({ ...baseConfig }, createSecureKeyValueStore(bridge)),
    [injectedClient, baseConfig, bridge],
  );
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const [info, storedLocale] = await Promise.all([
        bridge.invoke('app.info', {}).catch(() => null),
        bridge.invoke('secureStorage.get', { key: LOCALE_PREFERENCE_KEY }).catch(() => null),
        client.sessions.load().catch(() => null),
      ]);
      if (cancelled) return;
      setAppInfo(info);
      const preferred = storedLocale?.value;
      if (preferred === 'en' || preferred === 'id') setLocale(preferred);
      setReady(true);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [bridge, client]);

  const services: AppServices = { config, client, bridge, appInfo, t };

  const changeLocale = (next: AppLocale) => {
    setLocale(next);
    void bridge
      .invoke('secureStorage.set', { key: LOCALE_PREFERENCE_KEY, value: next })
      .catch(() => {});
  };

  const tabs: Tab<TabKey>[] = [
    { key: 'home', label: t('tab.home') },
    config.backend === 'awcms'
      ? { key: 'search', label: t('tab.search') }
      : { key: 'catalog', label: t('tab.catalog') },
    { key: 'account', label: t('tab.account') },
    { key: 'settings', label: t('tab.settings') },
  ];

  return (
    <AppProvider value={services}>
      <view className="App">
        {ready ? (
          <view className="App__main">
            {tab === 'home' ? <HomeScreen /> : null}
            {tab === 'search' ? <SearchScreen /> : null}
            {tab === 'catalog' ? <CatalogScreen /> : null}
            {tab === 'account' ? <AccountScreen /> : null}
            {tab === 'settings' ? <SettingsScreen onLocaleChange={changeLocale} /> : null}
          </view>
        ) : (
          <Loading label={t('app.loading')} />
        )}
        <TabBar tabs={tabs} active={tab} onSelect={setTab} />
      </view>
    </AppProvider>
  );
}

/** Rendered instead of the app when the build's configuration does not validate. */
export function ConfigErrorScreen({ message, locale }: { message: string; locale: AppLocale }) {
  const t = createTranslator(locale);
  return (
    <view className="App">
      <view className="Screen">
        <view className="Screen__header">
          <text className="Screen__title" accessibility-element accessibility-heading>
            {t('app.configError.title')}
          </text>
        </view>
        <view className="Screen__content">
          <text className="Card__body">{t('app.configError.body')}</text>
          <text className="Field__error">{message}</text>
        </view>
      </view>
    </view>
  );
}
