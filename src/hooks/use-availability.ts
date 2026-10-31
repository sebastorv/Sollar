/** Consulta en lote dónde ver una lista de títulos (por ejemplo, resultados de búsqueda). */

import { useEffect, useState } from 'react';

import { itemKey } from '@/lib/library-item';
import { availabilityFrom } from '@/lib/providers';
import { getWatchProviders } from '@/lib/tmdb';
import type { Availability, MediaType } from '@/lib/types';

const cache = new Map<string, Availability>();
const MAX = 20;

export function useAvailabilityFor(titles: { id: number; mediaType: MediaType }[]): Record<string, Availability> {
  const [map, setMap] = useState<Record<string, Availability>>({});
  const signature = titles
    .slice(0, MAX)
    .map((t) => itemKey(t.mediaType, t.id))
    .join(',');

  useEffect(() => {
    let cancelled = false;
    const keys = signature ? signature.split(',') : [];
    const initial: Record<string, Availability> = {};
    for (const k of keys) {
      const hit = cache.get(k);
      if (hit) initial[k] = hit;
    }
    setMap(initial);
    const missing = keys.filter((k) => !cache.has(k));
    Promise.all(
      missing.map(async (k) => {
        const [type, id] = k.split(':');
        try {
          const a = availabilityFrom(await getWatchProviders(type as MediaType, Number(id)));
          cache.set(k, a);
          return [k, a] as const;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setMap((cur) => {
        const next = { ...cur };
        for (const r of rows) if (r) next[r[0]] = r[1];
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  return map;
}
