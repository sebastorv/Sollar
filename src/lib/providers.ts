/** Utilidades de disponibilidad: qué plataformas tienen un título y si alguna es tuya. */

import type { Availability, LibraryItem, TmdbProvider, TmdbWatchProviders } from './types';

export function availabilityFrom(p: TmdbWatchProviders | null): Availability {
  const names: Record<number, string> = {};
  const ids = (list?: TmdbProvider[]) =>
    (list ?? []).map((x) => {
      names[x.provider_id] = x.provider_name;
      return x.provider_id;
    });
  return {
    checkedAt: new Date().toISOString(),
    flatrate: ids(p?.flatrate),
    free: [...new Set([...ids(p?.free), ...ids(p?.ads)])],
    rent: ids(p?.rent),
    buy: ids(p?.buy),
    names,
  };
}

/** Plataformas donde se puede ver sin pagar extra: suscripción o gratis. */
export function streamableIds(a: Availability | null | undefined): number[] {
  return a ? [...new Set([...a.flatrate, ...a.free])] : [];
}

/** Ids de tus plataformas que tienen el título incluido. */
export function myMatches(item: Pick<LibraryItem, 'availability'>, mine: number[]): number[] {
  if (mine.length === 0) return [];
  const set = new Set(mine);
  return streamableIds(item.availability).filter((id) => set.has(id));
}

/** "En Netflix" o "En Netflix y 2 más". */
export function availableLabel(item: Pick<LibraryItem, 'availability'>, mine: number[]): string | null {
  const ids = myMatches(item, mine);
  if (ids.length === 0) return null;
  const first = item.availability?.names[ids[0]] ?? 'tu plataforma';
  return ids.length === 1 ? `En ${first}` : `En ${first} y ${ids.length - 1} más`;
}

/** Cuántos días pasaron desde la última revisión. */
export function daysSince(iso: string | undefined | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}
