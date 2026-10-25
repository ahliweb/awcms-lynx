import type { AppLocale } from '@awcms-lynx/platform';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Row, Screen, Section } from '../components/Screen.tsx';
import { useApp } from '../context.tsx';

const WEAK_STORAGE = new Set(['memory', 'app-file']);

/** What this build is connected to, and how honestly it can keep a session. */
export function SettingsScreen({
  onLocaleChange,
}: {
  onLocaleChange: (locale: AppLocale) => void;
}) {
  const { config, appInfo, bridge, t } = useApp();
  const storage = appInfo?.secureStorage ?? 'memory';
  return (
    <Screen title={t('settings.title')}>
      <Section title={t('settings.language')}>
        <view className="Inline">
          <Button
            variant={config.locale === 'id' ? 'primary' : 'secondary'}
            label="Bahasa Indonesia"
            onTap={() => onLocaleChange('id')}
          />
          <Button
            variant={config.locale === 'en' ? 'primary' : 'secondary'}
            label="English"
            onTap={() => onLocaleChange('en')}
          />
        </view>
      </Section>
      <Section title={t('home.backend')}>
        <Row label={t('home.backend')} value={config.backend} />
        <Row label={t('settings.apiBase')} value={config.apiBaseUrl} />
        {config.backend === 'awcms' ? (
          <Row label={t('settings.tenant')} value={config.tenantId ?? t('settings.tenant.none')} />
        ) : null}
        {config.storefrontOrigin ? (
          <Row label="Storefront" value={config.storefrontOrigin} />
        ) : null}
        <Row label={t('settings.environment')} value={config.environment} />
      </Section>
      <Section title={t('settings.host')}>
        <Row label={t('settings.host')} value={appInfo?.host ?? 'explorer'} />
        <Row label={t('settings.transport')} value={bridge.transport} />
        <Row label={t('settings.storage')} value={storage} />
        {appInfo ? <Row label={t('settings.version')} value={appInfo.appVersion} /> : null}
        {WEAK_STORAGE.has(storage) ? (
          <Notice tone="warning" message={t('settings.storage.weak')} />
        ) : null}
        {storage === 'browser-storage' ? (
          <Notice tone="info" message={t('settings.storage.browser')} />
        ) : null}
      </Section>
    </Screen>
  );
}
