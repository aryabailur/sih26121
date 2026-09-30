"use client";

import { useEffect, useRef, useState } from "react";

/** Width of an element (for hand-drawn SVG charts), tracked with a ResizeObserver. Returns a callback ref, so it
 *  also works for elements that mount later (e.g. after data loads). */
export function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/**
 * Minimal async loader keyed by `deps`: loading / error / reload, keeps the last good data
 * while a new key loads (stale-while-revalidate) so screens don't flash empty.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [nonce, setNonce] = useState(0);
  const runKey = `${JSON.stringify(deps)}#${nonce}`;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;
    fnRef
      .current()
      .then((data) => alive && setState({ key: runKey, data, error: null }))
      .catch((e) => alive && setState((s) => ({ key: runKey, data: s.data, error: e instanceof Error ? e.message : String(e) })));
    return () => {
      alive = false;
    };
  }, [runKey]);

  const current = state.key === runKey;
  return {
    data: state.data,
    error: current ? state.error : null,
    loading: !current,
    reload: () => setNonce((n) => n + 1),
  };
}
