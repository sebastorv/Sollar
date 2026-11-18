/**
 * En la web, la app revisa si hay una versión nueva publicada cada vez que vuelve a primer
 * plano (y cada pocos minutos) y se recarga sola. Así los cambios llegan al iPhone sin borrar
 * ni reinstalar nada.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

const BUILD = process.env.EXPO_PUBLIC_BUILD ?? '';

async function check() {
  if (!BUILD || typeof window === 'undefined') return;
  try {
    const base = document.querySelector('link[rel="manifest"]')?.getAttribute('href')?.replace(/manifest[^/]*$/, '') ?? '/';
    const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version: string };
    if (version && version !== BUILD) window.location.reload();
  } catch {
    // Sin conexión: se revisa la próxima vez.
  }
}

export function useAutoUpdate() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(check, 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, []);
}
