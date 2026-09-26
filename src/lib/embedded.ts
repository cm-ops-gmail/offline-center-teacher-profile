'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

function snapshot(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('source') === 'hq') sessionStorage.setItem('embedded', '1');
    return window.self !== window.top || sessionStorage.getItem('embedded') === '1';
  } catch {
    return true; // a blocked storage/top access means we are inside a cross-origin frame
  }
}

/** True when running inside HQ (?source=hq, or any iframe): the navbar is dropped and the sidebar becomes the app's own nav. */
export function useIsEmbedded(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
