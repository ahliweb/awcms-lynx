import { type SearchItem, snippetToText } from '@awcms-lynx/client';
import { useState } from '@lynx-js/react';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Loading, Screen } from '../components/Screen.tsx';
import { TextField } from '../components/TextField.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';

const MAX_QUERY = 128;

/** awcms public site search (`GET /api/v1/site-search/query`, anonymous, keyset-paged). */
export function SearchScreen() {
  const { client, config, t, bridge } = useApp();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooLong = query.length > MAX_QUERY;

  const search = async (append: boolean) => {
    const q = query.trim();
    if (!q || tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const page = await client.awcms.siteSearch({
        q,
        locale: config.locale,
        cursor: append ? cursor : null,
      });
      setItems((previous) => (append ? [...previous, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setSearched(q);
    } catch (caught) {
      setError(describeError(t, caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('search.title')}>
      <TextField
        label={t('search.title')}
        placeholder={t('search.placeholder')}
        maxlength={MAX_QUERY}
        onChange={setQuery}
        onConfirm={() => void search(false)}
        error={tooLong ? t('search.tooLong') : null}
      />
      <Button
        label={t('search.submit')}
        busy={busy}
        disabled={!query.trim() || tooLong}
        onTap={() => void search(false)}
      />
      {error ? <Notice tone="error" message={error} /> : null}
      {busy && items.length === 0 ? <Loading label={t('app.loading')} /> : null}
      {searched !== null && !busy && items.length === 0 && !error ? (
        <Notice tone="info" message={t('search.empty', { q: searched })} />
      ) : null}
      {items.map((item) => (
        <view
          key={`${item.resourceType}:${item.resourceId}`}
          className="Card"
          accessibility-element
          accessibility-traits="link"
          accessibility-label={item.title}
          bindtap={() => {
            void bridge
              .invoke('link.open', { url: absoluteUrl(config.apiBaseUrl, item.url) })
              .catch(() => {});
          }}
        >
          <text className="Card__title">{item.title}</text>
          <text className="Card__body">{snippetToText(item.snippet)}</text>
          <text className="Card__meta">{item.resourceType}</text>
        </view>
      ))}
      {cursor ? (
        <Button
          variant="secondary"
          label={t('search.more')}
          busy={busy}
          onTap={() => void search(true)}
        />
      ) : null}
    </Screen>
  );
}

function absoluteUrl(base: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = /^(https?:\/\/[^/]+)/i.exec(base)?.[1] ?? base;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
