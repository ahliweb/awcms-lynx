import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Loading, Row, Screen, Section } from '../components/Screen.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { formatDateTime } from '../i18n.ts';

interface Headline {
  id: string;
  title: string;
  summary: string | null;
  date: string | null;
}

/**
 * Health of the backend plus the latest public headlines. Both reads are
 * anonymous: awcms has `GET /api/v1/health` and the JSON Feed at `/feed.json`;
 * awcms-one's news list is the storefront's static `/index/berita.json`
 * because neither backend has an anonymous REST read for posts.
 */
export function HomeScreen() {
  const { client, config, t } = useApp();
  const health = useAsync(() => client.awcms.health(), [client]);
  const headlines = useAsync<Headline[]>(async () => {
    if (config.backend === 'awcms') {
      const feed = await client.awcms.feed({ locale: config.locale });
      return feed.items.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title ?? item.url ?? item.id,
        summary: item.summary ?? null,
        date: item.date_published ?? null,
      }));
    }
    if (!config.storefrontOrigin) return [];
    const news = await client.commerce.newsIndex();
    return news.slice(0, 10).map((item) => ({
      id: item.slug,
      title: item.title,
      summary: item.excerpt ?? null,
      date: item.date ?? null,
    }));
  }, [client, config]);

  return (
    <Screen title={config.appName}>
      <Section title={t('home.backend')}>
        <Row label={t('home.backend')} value={config.backend} />
        <Row label={t('settings.apiBase')} value={config.apiBaseUrl} />
        {health.state.status === 'loading' ? <Loading label={t('app.loading')} /> : null}
        {health.state.status === 'success' ? (
          <Row
            label={t('home.status')}
            value={`${t('home.status.ok')} · ${health.state.data.service}`}
          />
        ) : null}
        {health.state.status === 'error' ? (
          <view>
            <Notice
              tone="error"
              message={`${t('home.status.down')} — ${describeError(t, health.state.error)}`}
            />
            <Button variant="secondary" label={t('app.retry')} onTap={() => void health.run()} />
          </view>
        ) : null}
      </Section>
      <Section title={config.backend === 'awcms' ? t('home.latest') : t('home.news')}>
        {headlines.state.status === 'loading' ? <Loading label={t('app.loading')} /> : null}
        {headlines.state.status === 'error' ? (
          <Notice tone="error" message={describeError(t, headlines.state.error)} />
        ) : null}
        {headlines.state.status === 'success' && headlines.state.data.length === 0 ? (
          <Notice tone="info" message={t('home.latest.empty')} />
        ) : null}
        {headlines.state.status === 'success'
          ? headlines.state.data.map((item) => (
              <view
                key={item.id}
                className="Card"
                accessibility-element
                accessibility-label={item.title}
              >
                <text className="Card__title">{item.title}</text>
                {item.summary ? <text className="Card__body">{item.summary}</text> : null}
                {item.date ? <text className="Card__meta">{formatDateTime(item.date)}</text> : null}
              </view>
            ))
          : null}
      </Section>
    </Screen>
  );
}
