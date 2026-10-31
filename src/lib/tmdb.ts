/**
 * Cliente mínimo de la API de TMDB (https://developer.themoviedb.org).
 *
 * Durante el desarrollo el token se lee de EXPO_PUBLIC_TMDB_TOKEN (archivo .env).
 * IMPORTANTE: todo lo que empieza por EXPO_PUBLIC_ queda dentro de la app compilada.
 * Antes de publicar, las llamadas deben pasar por un servidor propio (por ejemplo
 * una Edge Function de Supabase) que guarde el token. Ver docs/PLAN.md, sección 6.
 */

import {
  DEMO_PROVIDERS,
  demoMovie,
  demoSearch,
  demoSeason,
  demoTrending,
  demoTv,
  demoWatchProviders,
} from './demo';
import type {
  ProviderInfo,
  TmdbMovie,
  TmdbSearchResult,
  TmdbSeason,
  TmdbTv,
  TmdbWatchProviders,
  MediaType,
} from './types';

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const TOKEN = process.env.EXPO_PUBLIC_TMDB_TOKEN ?? '';
export const LANGUAGE = process.env.EXPO_PUBLIC_LANGUAGE ?? 'es-MX';
export const REGION = process.env.EXPO_PUBLIC_REGION ?? 'CO';

export const hasToken = TOKEN.length > 0;

/** Sin token, la app usa el catálogo de demostración de demo.ts. */
export const isDemo = !hasToken;

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

/** Caché en memoria por sesión para no repetir llamadas al navegar. */
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 10 * 60 * 1000;

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasToken) {
    throw new TmdbError('Falta el token de TMDB. Copia .env.example como .env y pon tu token.');
  }
  const query = new URLSearchParams({ language: LANGUAGE, ...params }).toString();
  const url = `${API}${path}?${query}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    throw new TmdbError('Demasiadas solicitudes a TMDB. Espera unos segundos.', 429);
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB respondió ${res.status}`, res.status);
  }
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

export type ImageSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

export function imageUrl(path: string | null | undefined, size: ImageSize = 'w342'): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

export async function searchTitles(query: string, page = 1): Promise<TmdbSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (isDemo) return demoSearch(q);
  const data = await get<{ results: TmdbSearchResult[] }>('/search/multi', {
    query: q,
    page: String(page),
    include_adult: 'false',
  });
  return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
}

export async function getTrending(): Promise<TmdbSearchResult[]> {
  if (isDemo) return demoTrending();
  const data = await get<{ results: TmdbSearchResult[] }>('/trending/all/week');
  return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
}

function notFound(): never {
  throw new TmdbError('Este título no está en el catálogo de demostración.', 404);
}

export async function getMovie(id: number): Promise<TmdbMovie> {
  if (isDemo) return demoMovie(id) ?? notFound();
  return get<TmdbMovie>(`/movie/${id}`);
}

export async function getTv(id: number): Promise<TmdbTv> {
  if (isDemo) return demoTv(id) ?? notFound();
  return get<TmdbTv>(`/tv/${id}`);
}

export async function getSeason(tvId: number, season: number): Promise<TmdbSeason> {
  if (isDemo) return demoSeason(tvId, season) ?? notFound();
  return get<TmdbSeason>(`/tv/${tvId}/season/${season}`);
}

/**
 * Plataformas donde ver el título en la región configurada.
 * Los datos los aporta JustWatch: hay que mostrar la atribución "Datos de JustWatch".
 */
export async function getWatchProviders(
  type: MediaType,
  id: number,
): Promise<TmdbWatchProviders | null> {
  if (isDemo) return demoWatchProviders(id);
  const data = await get<{ results: Record<string, TmdbWatchProviders> }>(
    `/${type}/${id}/watch/providers`,
  );
  return data.results[REGION] ?? null;
}

type TmdbProviderListItem = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
  display_priorities?: Record<string, number>;
};

/** Plataformas disponibles en el país, de la más popular a la menos. */
export async function getProviderDirectory(): Promise<ProviderInfo[]> {
  if (isDemo) return DEMO_PROVIDERS;
  const [movie, tv] = await Promise.all(
    (['movie', 'tv'] as const).map((t) =>
      get<{ results: TmdbProviderListItem[] }>(`/watch/providers/${t}`, { watch_region: REGION }),
    ),
  );
  const byId = new Map<number, TmdbProviderListItem>();
  for (const p of [...movie.results, ...tv.results]) if (!byId.has(p.provider_id)) byId.set(p.provider_id, p);
  return [...byId.values()]
    .sort(
      (a, b) =>
        (a.display_priorities?.[REGION] ?? a.display_priority) -
        (b.display_priorities?.[REGION] ?? b.display_priority),
    )
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
}

/** Título y año de un resultado, sin importar si es película o serie. */
export function displayTitle(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? 'Sin título';
}

export function displayYear(r: { release_date?: string; first_air_date?: string }): string | null {
  const date = r.release_date || r.first_air_date;
  return date ? date.slice(0, 4) : null;
}
