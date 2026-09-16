/* One fetch, with the offline behaviour the installed app needs. */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetch once, expose a refresh, and keep the last good answer.
 *
 * On a phone the network comes and goes mid-journey, so a failed refresh must
 * not blank a screen that is already showing real figures. The previous data
 * stays put and `stale` goes true, which the UI reports as an age rather than
 * as an error — the difference between "no signal, these are from 09:14" and
 * "something is broken" matters when someone is reading it in a warehouse.
 *
 * `deps` identify the question being asked. Change them and the previous
 * answer is dropped immediately, because a caller that switches between
 * differently shaped payloads must never see one rendered against the other.
 */
export function useLiveData(fetcher, deps = []) {
  // The deps are primitives (a report name, an id), so serialising them gives
  // a value that can be compared by identity across renders.
  const depsKey = JSON.stringify(deps);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [stale, setStale] = useState(false);
  const [activeKey, setActiveKey] = useState(depsKey);

  const hasData = useRef(false);
  const alive = useRef(true);

  // The caller passes a fresh closure on every render. Holding it in a ref
  // keeps `load` tied to the deps the caller declared rather than to the
  // identity of that closure, which would rebuild it constantly.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // What is being asked for right now, readable from inside an async call
  // that started before the question changed.
  const keyRef = useRef(depsKey);
  keyRef.current = depsKey;

  // Deps changed: drop the previous answer during this very render.
  //
  // An effect would be one render too late. React renders with the new deps
  // and the old data first, and a screen switching between reports of
  // different shapes crashes on that render — before any effect could clear
  // it. Setting state during render of the same component is the supported
  // way to adjust state when inputs change; React re-runs the component
  // before touching the DOM.
  if (activeKey !== depsKey) {
    setActiveKey(depsKey);
    setData(null);
    setError(null);
    setStale(false);
    setLoading(true);
    hasData.current = false;
  }

  // Set on mount as well as cleared on unmount. Clearing alone would be a bug
  // that only shows up the second time a screen is mounted — including every
  // mount under StrictMode, which unmounts once deliberately — leaving the ref
  // false for good and every later result silently thrown away.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      // Discard an answer to a question nobody is asking any more: the tab
      // may have moved on while this was in flight, and storing it would put
      // the old shape back under the new view.
      if (!alive.current || keyRef.current !== depsKey) return;
      setData(result);
      hasData.current = true;
      setUpdatedAt(new Date());
      setStale(false);
      setError(null);
    } catch (e) {
      if (!alive.current || keyRef.current !== depsKey) return;
      // Only an empty screen is an error; otherwise it is just old.
      if (hasData.current) setStale(true);
      else setError(e?.message || 'Could not reach the server');
    } finally {
      if (alive.current && keyRef.current === depsKey) setLoading(false);
    }
  }, [depsKey]);

  useEffect(() => { load(); }, [load]);

  // Coming back onto the network, or back to the app from the background,
  // should show current figures without the user thinking to pull down.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  return { data, error, loading, updatedAt, stale, reload: load };
}
