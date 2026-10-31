/**
 * Filtros y orden de "Mi lista". Funciones puras: reciben la biblioteca y devuelven
 * los títulos que cumplen todo lo elegido, en el orden pedido.
 */

import { nextEpisode, progressOf } from './progress';
import { myMatches, streamableIds } from './providers';
import type { LibraryItem, MediaType, WatchStatus } from './types';

/** Disponibilidad: todo, en alguna de mis plataformas, en una plataforma concreta, o en ninguna mía. */
export type AvailabilityFilter = 'all' | 'mine' | 'notMine' | { provider: number };

/** Duración: corta = película de hasta 100 min o episodios de hasta 30 min. */
export type LengthFilter = 'any' | 'short' | 'medium' | 'long';

export type RatingFilter = 'any' | '8' | '6' | 'unrated';

export type SortKey = 'recent' | 'added' | 'title' | 'rating' | 'year' | 'progress' | 'remaining';

export type Filters = {
  status: WatchStatus | 'all';
  type: 'all' | MediaType;
  availability: AvailabilityFilter;
  genres: string[];
  length: LengthFilter;
  rating: RatingFilter;
  decade: number | null;
  /** Solo series con episodios pendientes ya emitidos. */
  pendingOnly: boolean;
  sort: SortKey;
};

export const DEFAULT_FILTERS: Filters = {
  status: 'all',
  type: 'all',
  availability: 'all',
  genres: [],
  length: 'any',
  rating: 'any',
  decade: null,
  pendingOnly: false,
  sort: 'recent',
};

export const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Actividad reciente',
  added: 'Agregados recientemente',
  title: 'Título (A-Z)',
  rating: 'Tu calificación',
  year: 'Año (más nuevo)',
  progress: 'Progreso',
  remaining: 'Menos tiempo restante',
};

export const LENGTH_LABEL: Record<LengthFilter, string> = {
  any: 'Cualquiera',
  short: 'Corta',
  medium: 'Media',
  long: 'Larga',
};

export const RATING_LABEL: Record<RatingFilter, string> = {
  any: 'Cualquiera',
  '8': '8 o más',
  '6': '6 o más',
  unrated: 'Sin calificar',
};

function lengthOf(item: LibraryItem): LengthFilter {
  const r = item.runtime ?? 0;
  if (r === 0) return 'any';
  if (item.mediaType === 'movie') return r <= 100 ? 'short' : r <= 140 ? 'medium' : 'long';
  return r <= 30 ? 'short' : r <= 50 ? 'medium' : 'long';
}

/** Minutos que faltan: la película entera, o los episodios sin ver de la serie. */
export function remainingMinutes(item: LibraryItem): number {
  const r = item.runtime ?? 0;
  if (item.mediaType === 'movie') return item.watchedAt ? 0 : r;
  const total = item.seasons.reduce((a, s) => a + s.episodeCount, 0);
  return Math.max(0, total - Object.keys(item.watchedEpisodes).length) * r;
}

export function applyFilters(items: LibraryItem[], f: Filters, myProviders: number[]): LibraryItem[] {
  const out = items.filter((i) => {
    if (f.status !== 'all' && i.status !== f.status) return false;
    if (f.type !== 'all' && i.mediaType !== f.type) return false;

    if (f.availability === 'mine' && myMatches(i, myProviders).length === 0) return false;
    if (f.availability === 'notMine' && myMatches(i, myProviders).length > 0) return false;
    if (typeof f.availability === 'object' && !streamableIds(i.availability).includes(f.availability.provider)) {
      return false;
    }

    if (f.genres.length > 0 && !f.genres.some((g) => i.genres.includes(g))) return false;
    if (f.length !== 'any' && lengthOf(i) !== f.length) return false;

    if (f.rating === 'unrated' && i.rating != null) return false;
    if ((f.rating === '8' || f.rating === '6') && (i.rating ?? 0) < Number(f.rating)) return false;

    if (f.decade != null) {
      const y = Number(i.year);
      if (!y || Math.floor(y / 10) * 10 !== f.decade) return false;
    }

    if (f.pendingOnly && (i.mediaType !== 'tv' || nextEpisode(i) === null)) return false;
    return true;
  });

  const by: Record<SortKey, (a: LibraryItem, b: LibraryItem) => number> = {
    recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    added: (a, b) => b.addedAt.localeCompare(a.addedAt),
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    year: (a, b) => Number(b.year ?? 0) - Number(a.year ?? 0),
    progress: (a, b) => progressOf(b) - progressOf(a),
    remaining: (a, b) => remainingMinutes(a) - remainingMinutes(b),
  };
  return out.sort(by[f.sort]);
}

/** Cuántos filtros del panel están activos (estado y tipo van aparte, en la pantalla). */
export function activeCount(f: Filters): number {
  return (
    (f.availability !== 'all' ? 1 : 0) +
    (f.genres.length > 0 ? 1 : 0) +
    (f.length !== 'any' ? 1 : 0) +
    (f.rating !== 'any' ? 1 : 0) +
    (f.decade != null ? 1 : 0) +
    (f.pendingOnly ? 1 : 0) +
    (f.sort !== 'recent' ? 1 : 0)
  );
}

/** Géneros y décadas presentes en la biblioteca, para ofrecer solo opciones con resultados. */
export function facets(items: LibraryItem[]) {
  const genres = new Map<string, number>();
  const decades = new Set<number>();
  for (const i of items) {
    for (const g of i.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    const y = Number(i.year);
    if (y) decades.add(Math.floor(y / 10) * 10);
  }
  return {
    genres: [...genres.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g),
    decades: [...decades].sort((a, b) => b - a),
  };
}
