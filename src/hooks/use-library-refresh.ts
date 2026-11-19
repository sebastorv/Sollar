/**
 * Mantiene al día, en segundo plano y despacio, lo que tienes guardado:
 * - El nombre de cada título en el idioma de la app (para no mezclar idiomas).
 * - Dónde verlo (para que el logo de la plataforma salga en las carátulas sin abrir la ficha).
 * Empieza por lo que estás viendo y lo que tienes pendiente.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { useLang } from '@/i18n';
import { availabilityFrom } from '@/lib/providers';
import { getMovie, getTv, getWatchProviders, isDemo, REGION } from '@/lib/tmdb';
import type { LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';

const PER_SESSION = 300;
const STALE_DAYS = 5;

function priority(i: LibraryItem) {
  const order = { watching: 0, planned: 1, paused: 2, completed: 3, dropped: 4 } as const;
  return order[i.status] ?? 5;
}

export function useLibraryRefresh() {
  const lib = useLibrary();
  const { lang } = useLang();
  const libRef = useRef(lib);
  libRef.current = lib;
  const running = useRef<string | null>(null);

  useEffect(() => {
    if (isDemo || !lib.ready || lib.items.length === 0) return;
    const run = `${lang}:${REGION}`;
    if (running.current === run) return;
    running.current = run;
    (async () => {
      await new Promise((r) => setTimeout(r, 4000));
      const KEY = `sollar.names.${lang}.v1`;
      const named = new Set<string>(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'));
      const now = Date.now();
      const stale = (i: LibraryItem) =>
        !i.availability || now - Date.parse(i.availability.checkedAt) > STALE_DAYS * 86_400_000 || (i.availability as { region?: string }).region !== REGION;
      const queue = [...libRef.current.items]
        .filter((i) => !named.has(i.key) || stale(i))
        .sort((a, b) => priority(a) - priority(b))
        .slice(0, PER_SESSION);
      let n = 0;
      for (const i of queue) {
        if (running.current !== run) return;
        try {
          if (!named.has(i.key)) {
            const d = i.mediaType === 'tv' ? await getTv(i.tmdbId) : await getMovie(i.tmdbId);
            const title = 'name' in d ? d.name : d.title;
            const genres = d.genres.map((g) => g.name);
            if (title && (title !== i.title || genres.join() !== i.genres.join())) libRef.current.setMeta(i.key, { title, genres });
            named.add(i.key);
          }
          if (stale(i)) {
            const a = availabilityFrom(await getWatchProviders(i.mediaType, i.tmdbId));
            libRef.current.setAvailability(i.key, { ...a, region: REGION } as typeof a);
          }
        } catch {
          // Se intenta en otra sesión.
        }
        if (++n % 10 === 0) AsyncStorage.setItem(KEY, JSON.stringify([...named])).catch(() => {});
        await new Promise((r) => setTimeout(r, 350));
      }
      AsyncStorage.setItem(KEY, JSON.stringify([...named])).catch(() => {});
    })();
  }, [lib.ready, lib.items.length, lang]);
}
