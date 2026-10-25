import { type CustomerSession, formatMoney, type StaffSession } from '@awcms-lynx/client';
import { useState } from '@lynx-js/react';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Loading, Row, Screen, Section } from '../components/Screen.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useSession } from '../hooks/useSession.ts';
import { formatDateTime } from '../i18n.ts';
import { CustomerSignInScreen } from './CustomerSignInScreen.tsx';
import { StaffSignInScreen } from './StaffSignInScreen.tsx';

/** Signed out → the backend's sign-in flow; signed in → who, what, and sign out. */
export function AccountScreen() {
  const { config } = useApp();
  const session = useSession();
  if (config.backend === 'awcms') {
    return session?.kind === 'staff' ? <StaffAccount session={session} /> : <StaffSignInScreen />;
  }
  return session?.kind === 'customer' ? (
    <CustomerAccount session={session} />
  ) : (
    <CustomerSignInScreen />
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      label={t('account.signOut')}
      busy={busy}
      onTap={() => {
        setBusy(true);
        // logout() clears the local session even when the server call fails,
        // so this always lands on the sign-in screen.
        void onSignOut().finally(() => setBusy(false));
      }}
    />
  );
}

function StaffAccount({ session }: { session: StaffSession }) {
  const { client, t } = useApp();
  const introspection = useAsync(() => client.awcms.session(), [client, session.token]);
  return (
    <Screen title={t('account.title')}>
      {introspection.state.status === 'loading' ? <Loading label={t('app.loading')} /> : null}
      {introspection.state.status === 'error' ? (
        <Notice tone="error" message={describeError(t, introspection.state.error)} />
      ) : null}
      {introspection.state.status === 'success' ? (
        <Section>
          <Row
            label={t('account.signedInAs')}
            value={introspection.state.data.displayName ?? introspection.state.data.identityId}
          />
          <Row
            label={t('account.roles')}
            value={introspection.state.data.roles.join(', ') || '—'}
          />
          <Row
            label={t('account.assurance')}
            value={introspection.state.data.assuranceLevel ?? session.assuranceLevel}
          />
        </Section>
      ) : null}
      <Section>
        <Row label={t('settings.tenant')} value={session.tenantId} />
        <Row label={t('account.expires')} value={formatDateTime(session.expiresAt)} />
        <SignOutButton onSignOut={() => client.awcms.logout()} />
      </Section>
    </Screen>
  );
}

function CustomerAccount({ session }: { session: CustomerSession }) {
  const { client, config, t } = useApp();
  const orders = useAsync(() => client.commerce.orders(), [client, session.token]);
  const account = session.account;
  return (
    <Screen title={t('account.title')}>
      <Section>
        <Row label={t('account.signedInAs')} value={account.name} />
        {account.email ? <Row label={t('signIn.customer.email')} value={account.email} /> : null}
        {account.level ? <Row label={t('account.level')} value={account.level} /> : null}
      </Section>
      <Section title={t('account.orders')}>
        {orders.state.status === 'loading' ? <Loading label={t('app.loading')} /> : null}
        {orders.state.status === 'error' ? (
          <Notice tone="error" message={describeError(t, orders.state.error)} />
        ) : null}
        {orders.state.status === 'success' && orders.state.data.items.length === 0 ? (
          <Notice tone="info" message={t('account.orders.empty')} />
        ) : null}
        {orders.state.status === 'success'
          ? orders.state.data.items.map((order) => (
              <view
                key={order.code}
                className="Card"
                accessibility-element
                accessibility-label={order.code}
              >
                <text className="Card__title">{order.code}</text>
                <text className="Card__price">
                  {formatMoney(String(order.total ?? '0.00'), config.locale)}
                </text>
                <text className="Card__meta">{`${order.status} · ${formatDateTime(order.createdAt)}`}</text>
              </view>
            ))
          : null}
      </Section>
      <Section>
        <SignOutButton onSignOut={() => client.commerce.logout()} />
      </Section>
    </Screen>
  );
}
