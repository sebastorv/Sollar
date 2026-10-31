/**
 * Cliente mínimo de la API de TMDB (https://developer.themoviedb.org).
 *
 * Durante el desarrollo el token se lee de EXPO_PUBLIC_TMDB_TOKEN (archivo .env).
 * IMPORTANTE: todo lo que empieza por EXPO_PUBLIC_ queda dentro de la app compilada.
 * Antes de publicar, las llamadas deben pasar por un servidor propio (por ejemplo
 * una Edge Function de Supabase) que guarde el token. Ver docs/PLAN.md, sección 6.
 */

import type {
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
  const data = await get<{ results: TmdbSearchResult[] }>('/search/multi', {
    query: q,
    page: String(page),
    include_adult: 'false',
  });
  return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
}

export async function getTrending(): Promise<TmdbSearchResult[]> {
  const data = await get<{ results: TmdbSearchResult[] }>('/trending/all/week');
  return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
}

export function getMovie(id: number): Promise<TmdbMovie> {
  return get<TmdbMovie>(`/movie/${id}`);
}

export function getTv(id: number): Promise<TmdbTv> {
  return get<TmdbTv>(`/tv/${id}`);
}

export function getSeason(tvId: number, season: number): Promise<TmdbSeason> {
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
  const data = await get<{ results: Record<string, TmdbWatchProviders> }>(
    `/${type}/${id}/watch/providers`,
  );
  return data.results[REGION] ?? null;
}

/** Título y año de un resultado, sin importar si es película o serie. */
export function displayTitle(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? 'Sin título';
}

export function displayYear(r: { release_date?: string; first_air_date?: string }): string | null {
  const date = r.release_date || r.first_air_date;
  return date ? date.slice(0, 4) : null;
}
