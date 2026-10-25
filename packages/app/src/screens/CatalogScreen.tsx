import { formatMoney } from '@awcms-lynx/client';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Loading, Screen } from '../components/Screen.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';
import { useAsync } from '../hooks/useAsync.ts';

/**
 * awcms-one catalog from the storefront's static product index
 * (`{storefrontOrigin}/index/produk.json`). The commerce product API needs a
 * staff/machine token (awcms-one docs/api.md: "there is no anonymous tier"),
 * and a machine secret must never ship inside a public app bundle.
 */
export function CatalogScreen() {
  const { client, config, t } = useApp();
  const products = useAsync(() => client.commerce.productIndex(), [client]);

  if (!config.storefrontOrigin) {
    return (
      <Screen title={t('catalog.title')}>
        <Notice tone="warning" message={t('catalog.notConfigured')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('catalog.title')}>
      {products.state.status === 'loading' ? <Loading label={t('app.loading')} /> : null}
      {products.state.status === 'error' ? (
        <view>
          <Notice tone="error" message={describeError(t, products.state.error)} />
          <Button variant="secondary" label={t('app.retry')} onTap={() => void products.run()} />
        </view>
      ) : null}
      {products.state.status === 'success' && products.state.data.length === 0 ? (
        <Notice tone="info" message={t('catalog.empty')} />
      ) : null}
      {products.state.status === 'success'
        ? products.state.data.map((product) => {
            const discounted = product.finalPrice && product.finalPrice !== product.price;
            const price = formatMoney(product.finalPrice || product.price, config.locale);
            return (
              <view
                key={product.id}
                className="Card Card--product"
                accessibility-element
                accessibility-label={`${product.name}, ${price}`}
              >
                {product.image ? (
                  <image
                    className="Card__image"
                    src={product.image.url}
                    mode="aspectFill"
                    accessibility-label={product.image.alt || product.name}
                  />
                ) : null}
                <view className="Card__text">
                  <text className="Card__title">{product.name}</text>
                  <text className="Card__price">{price}</text>
                  {discounted ? (
                    <text className="Card__strike">
                      {formatMoney(product.price, config.locale)}
                    </text>
                  ) : null}
                  <text className="Card__meta">
                    {[
                      product.categoryName,
                      product.inFlashSale ? t('catalog.flashSale') : null,
                      Number(product.stock) <= 0 ? t('catalog.outOfStock') : null,
                      product.sold ? t('catalog.sold', { n: product.sold }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </text>
                </view>
              </view>
            );
          })
        : null}
    </Screen>
  );
}
