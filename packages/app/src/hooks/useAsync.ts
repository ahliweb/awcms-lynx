import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

/**
 * Runs `task` on mount (when `immediate`) and on `run()`. A result that comes
 * back after the component unmounted, or after a newer run started, is
 * dropped — the usual stale-response race on slow mobile networks.
 */
export function useAsync<T>(task: () => Promise<T>, deps: unknown[], immediate = true) {
  const [state, setState] = useState<AsyncState<T>>(
    immediate ? { status: 'loading' } : { status: 'idle' },
  );
  const generation = useRef(0);
  const mounted = useRef(true);

  const run = useCallback(() => {
    const current = ++generation.current;
    setState({ status: 'loading' });
    return task().then(
      (data) => {
        if (mounted.current && current === generation.current)
          setState({ status: 'success', data });
      },
      (error: unknown) => {
        if (mounted.current && current === generation.current) setState({ status: 'error', error });
      },
    );
  }, deps);

  useEffect(() => {
    mounted.current = true;
    if (immediate) void run();
    return () => {
      mounted.current = false;
    };
  }, [run, immediate]);

  return { state, run };
}
