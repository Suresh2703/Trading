/* Registering the service worker, and the install prompt it makes possible. */
import { useEffect, useState } from 'react';

/**
 * Register the worker, in production only.
 *
 * Vite serves unbundled modules in development, and a cache-first worker in
 * front of them hands back yesterday's code after every edit. The installed
 * app is a production build, so nothing is lost by staying out of the way.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // An unregistered worker costs offline support, not the app.
    });
  });
}

/** Drop the cached API answers. Called on sign-out. */
export function purgeCachedData() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'purge-data' });
}

/** True once the app is running from the home screen rather than a browser tab. */
export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * The Android install prompt.
 *
 * Chrome fires `beforeinstallprompt` when it decides the app is installable,
 * and the event is the only handle on that prompt — so it is kept until the
 * user asks for it. iOS fires nothing and has no programmatic install, so
 * there `supported` stays false and the UI explains the Share-sheet route
 * instead of offering a button that could not work.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use whatever the answer.
    setDeferred(null);
    return outcome === 'accepted';
  };

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return { supported: Boolean(deferred), installed, isIos, promptInstall };
}
