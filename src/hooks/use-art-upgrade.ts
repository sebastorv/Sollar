/**
 * Carátulas originales para lo que ya tienes guardado. Los títulos importados o guardados antes
 * traen la carátula en español, que a veces lleva letreros ("Serie de Netflix"). En segundo
 * plano, poco a poco, se cambian por la original. Empieza por lo que más ves.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { getOriginalPoster, isDemo } from '@/lib/tmdb';
import type { LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';

const KEY = 'sollar.art.v1';
const PER_SESSION = 160;

function priority(i: LibraryItem) {
  const order = { watching: 0, paused: 1, planned: 2, completed: 3, dropped: 4 } as const;
  return order[i.status] ?? 5;
}

export function useArtUpgrade() {
  const lib = useLibrary();
  const started = useRef(false);
  const libRef = useRef(lib);
  libRef.current = lib;

  useEffect(() => {
    if (isDemo || started.current || !lib.ready || lib.items.length === 0) return;
    started.current = true;
    (async () => {
      // Espera a que termine la primera sincronización.
      await new Promise((r) => setTimeout(r, 8000));
      const done = new Set<string>(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'));
      const queue = [...libRef.current.items]
        .filter((i) => !done.has(i.key))
        .sort((a, b) => priority(a) - priority(b))
        .slice(0, PER_SESSION);
      let n = 0;
      for (const i of queue) {
        try {
          const p = await getOriginalPoster(i.mediaType, i.tmdbId);
          const cur = libRef.current.get(i.key);
          if (p && cur && !cur.posterCustom && cur.posterPath !== p) libRef.current.setPoster(i.key, p);
          done.add(i.key);
        } catch {
          // Si falla, se intenta en otra sesión.
        }
        if (++n % 10 === 0) AsyncStorage.setItem(KEY, JSON.stringify([...done])).catch(() => {});
        // Despacio, para no frenar la app ni gastar el límite de TMDB.
        await new Promise((r) => setTimeout(r, 700));
      }
      AsyncStorage.setItem(KEY, JSON.stringify([...done])).catch(() => {});
    })();
  }, [lib.ready, lib.items.length]);
}
