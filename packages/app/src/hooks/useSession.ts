import type { Session } from '@awcms-lynx/client';
import { useEffect, useState } from '@lynx-js/react';
import { useApp } from '../context.tsx';

/** The current session, re-rendering on sign-in, sign-out and server-side expiry (401). */
export function useSession(): Session | null {
  const { client } = useApp();
  const [session, setSession] = useState<Session | null>(() => client.sessions.current());
  useEffect(() => client.sessions.subscribe(setSession), [client]);
  return session;
}
