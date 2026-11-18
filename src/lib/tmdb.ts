/**
 * Cliente mínimo de la API de TMDB (https://developer.themoviedb.org).
 *
 * Con Supabase configurado, las llamadas pasan por la función "tmdb" del servidor
 * (supabase/functions/tmdb), que guarda el token en secreto y solo atiende a usuarios
 * con sesión iniciada. Sin Supabase, para desarrollo, se usa EXPO_PUBLIC_TMDB_TOKEN.
 * Sin ninguno de los dos, la app usa el catálogo de demostración.
 */

import { PixelRatio } from 'react-native';

import { accessToken, hasCloud, SUPABASE_KEY, SUPABASE_URL } from './supabase';

import { addDays, todayISO } from './dates';
import {
  DEMO_PROVIDERS,
  demoMovie,
  demoOnProviders,
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

/** Sin token ni servidor, la app usa el catálogo de demostración de demo.ts. */
export const isDemo = !hasToken && !hasCloud;

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

async function get<T>(path: string, params: Record<string, string> = {}, useCache = true): Promise<T> {
  if (isDemo) {
    throw new TmdbError('Falta configurar TMDB. Copia .env.example como .env.');
  }
  const query = new URLSearchParams({ language: LANGUAGE, ...params }).toString();
  const viaServer = !hasToken && hasCloud;
  const url = viaServer ? `${SUPABASE_URL}/functions/v1/tmdb${path}?${query}` : `${API}${path}?${query}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;

  let headers: Record<string, string>;
  if (viaServer) {
    const session = await accessToken();
    if (!session) throw new TmdbError('Inicia sesión para ver el catálogo.', 401);
    headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${session}`, Accept: 'application/json' };
  } else {
    headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
  }
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    throw new TmdbError('Demasiadas solicitudes a TMDB. Espera unos segundos.', 429);
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB respondió ${res.status}`, res.status);
  }
  const data = (await res.json()) as T;
  if (!params.language) await cleanListPosters(path, params, data);
  if (useCache) cache.set(url, { at: Date.now(), data });
  return data;
}

/**
 * Carátulas limpias: las versiones latinoamericanas suelen venir con letreros de la plataforma
 * ("Serie de Netflix", "Solo en cines"). Para listas (búsqueda, tendencias, descubrir) se pide la
 * misma página en inglés, que trae la carátula original de cada título, y se cambia solo la imagen.
 */
async function cleanListPosters(path: string, params: Record<string, string>, data: unknown) {
  const results = (data as { results?: { id: number; poster_path?: string | null }[] }).results;
  if (!Array.isArray(results) || !results.some((r) => r && 'poster_path' in r)) return;
  try {
    const en = await get<{ results: { id: number; poster_path?: string | null }[] }>(path, { ...params, language: 'en-US' });
    const byId = new Map(en.results.map((r) => [r.id, r.poster_path]));
    for (const r of results) {
      const clean = byId.get(r.id);
      if (clean) r.poster_path = clean;
    }
  } catch {
    // Si falla, se quedan las carátulas en español.
  }
}

type RawImage = { file_path: string; iso_639_1: string | null; vote_average: number; vote_count: number; aspect_ratio?: number };

/** La carátula original del título: en inglés o sin texto, la mejor votada. */
function bestPoster(posters: RawImage[] | undefined, original?: string | null): string | null {
  if (!posters?.length) return null;
  // La original: en el idioma original del título; si no hay, en inglés; luego sin texto.
  const lang = (p: RawImage) => (original && p.iso_639_1 === original ? 2 : p.iso_639_1 === 'en' ? 1 : p.iso_639_1 === null ? 0.5 : 0);
  const score = (p: RawImage) => lang(p) * 2 + p.vote_average / 10 + Math.min(p.vote_count, 20) / 100;
  return [...posters].sort((a, b) => score(b) - score(a))[0]?.file_path ?? null;
}

export type ImageSize = 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

export function imageUrl(path: string | null | undefined, size: ImageSize = 'w342'): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

/** Tamaños que TMDB ofrece por tipo de imagen, de menor a mayor (en píxeles de ancho). */
const SIZES: Record<'poster' | 'backdrop' | 'still' | 'logo', [ImageSize, number][]> = {
  poster: [['w154', 154], ['w185', 185], ['w342', 342], ['w500', 500], ['w780', 780], ['original', 2000]],
  backdrop: [['w300', 300], ['w780', 780], ['w1280', 1280], ['original', 3840]],
  still: [['w185', 185], ['w300', 300], ['original', 1920]],
  logo: [['w92', 92], ['w154', 154], ['w185', 185], ['w300', 300], ['w500', 500], ['original', 1000]],
};

/**
 * La imagen más liviana que se ve nítida: el ancho en pantalla por la densidad de píxeles
 * (2x o 3x en celulares), con un margen. En pantallas 4K los fondos usan el original.
 */
export function sharpImage(
  path: string | null | undefined,
  kind: keyof typeof SIZES,
  widthOnScreen: number,
): string | null {
  if (!path) return null;
  const density = Math.min(PixelRatio.get() || 2, 3);
  const needed = widthOnScreen * density * 1.1;
  const options = SIZES[kind];
  const pick = options.find(([, w]) => w >= needed) ?? options[options.length - 1];
  return `${IMG}/${pick[0]}${path}`;
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

/** useCache = false para consultas masivas (importar miles de títulos sin llenar la memoria). */
export async function getMovie(id: number, useCache = true): Promise<TmdbMovie> {
  if (isDemo) return demoMovie(id) ?? notFound();
  return get<TmdbMovie>(`/movie/${id}`, {}, useCache);
}

export async function getTv(id: number, useCache = true): Promise<TmdbTv> {
  if (isDemo) return demoTv(id) ?? notFound();
  return get<TmdbTv>(`/tv/${id}`, {}, useCache);
}

export async function getSeason(tvId: number, season: number): Promise<TmdbSeason> {
  if (isDemo) return demoSeason(tvId, season) ?? notFound();
  return get<TmdbSeason>(`/tv/${tvId}/season/${season}`);
}

/**
 * Plataformas donde ver el título en la región configurada.
 * Los datos los aporta JustWatch: hay que mostrar la atribución "Datos de JustWatch".
 */
export async function getWatchProviders(type: MediaType, id: number): Promise<TmdbWatchProviders | null> {
  if (isDemo) return demoWatchProviders(id);
  const data = await get<{ results: Record<string, TmdbWatchProviders> }>(`/${type}/${id}/watch/providers`);
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
        (a.display_priorities?.[REGION] ?? a.display_priority) - (b.display_priorities?.[REGION] ?? b.display_priority),
    )
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
}

type DiscoverItem = Omit<TmdbSearchResult, 'media_type'>;

/**
 * Lo más reciente en las plataformas que paga la persona: películas y series estrenadas en los
 * últimos meses que están incluidas en esas suscripciones en el país. TMDB no informa el día en que
 * un título llega a una plataforma, así que se usa la fecha de estreno.
 */
export async function getNewOnProviders(providerIds: number[]): Promise<TmdbSearchResult[]> {
  if (providerIds.length === 0) return [];
  if (isDemo) return demoOnProviders(providerIds);
  const today = todayISO();
  const since = addDays(today, -120);
  const common = {
    watch_region: REGION,
    with_watch_providers: providerIds.join('|'),
    with_watch_monetization_types: 'flatrate',
    include_adult: 'false',
  };
  const [movies, tv] = await Promise.all([
    get<{ results: DiscoverItem[] }>('/discover/movie', {
      ...common,
      sort_by: 'primary_release_date.desc',
      'primary_release_date.lte': today,
      'primary_release_date.gte': since,
      'vote_count.gte': '5',
    }),
    get<{ results: DiscoverItem[] }>('/discover/tv', {
      ...common,
      sort_by: 'first_air_date.desc',
      'first_air_date.lte': today,
      'first_air_date.gte': since,
      'vote_count.gte': '3',
    }),
  ]);
  const all: TmdbSearchResult[] = [
    ...movies.results.map((m) => ({ ...m, media_type: 'movie' as const })),
    ...tv.results.map((t) => ({ ...t, media_type: 'tv' as const })),
  ];
  return all.sort((a, b) =>
    (b.release_date ?? b.first_air_date ?? '').localeCompare(a.release_date ?? a.first_air_date ?? ''),
  );
}

/** Películas que se estrenan pronto en el país. */
export async function getUpcomingMovies(): Promise<TmdbSearchResult[]> {
  if (isDemo) return [];
  const today = todayISO();
  const data = await get<{ results: DiscoverItem[] }>('/discover/movie', {
    region: REGION,
    sort_by: 'popularity.desc',
    'primary_release_date.gte': today,
    'primary_release_date.lte': addDays(today, 90),
    with_release_type: '2|3',
    include_adult: 'false',
  });
  return data.results
    .map((m) => ({ ...m, media_type: 'movie' as const }))
    .sort((a, b) => (a.release_date ?? '').localeCompare(b.release_date ?? ''));
}

/** Título y año de un resultado, sin importar si es película o serie. */
export function displayTitle(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? 'Sin título';
}

export function displayYear(r: { release_date?: string; first_air_date?: string }): string | null {
  const date = r.release_date || r.first_air_date;
  return date ? date.slice(0, 4) : null;
}

// --- Ficha completa: reparto, tráiler, recomendaciones, detalles ---

export type CastMember = { id: number; name: string; character: string; profilePath: string | null };
export type TitleExtras = {
  cast: CastMember[];
  /** Dirección (películas) o creadores (series). */
  makers: string[];
  trailerKey: string | null;
  recommendations: TmdbSearchResult[];
  imdbId: string | null;
  certification: string | null;
  networks: string[];
  originalTitle: string | null;
  originalLanguage: string | null;
  homepage: string | null;
  voteCount: number;
  /** Carátula original (sin letreros de la plataforma). */
  poster: string | null;
  /** Fondo sin texto. */
  backdrop: string | null;
  /** Logo con el nombre del título, para la portada. */
  logo: string | null;
  /** Ancho entre alto del logo, para darle el espacio justo. */
  logoAspect: number;
  /** Tráileres, avances y clips de YouTube, el mejor primero. */
  videos: { key: string; name: string; type: string }[];
  /** Fondos sin texto (fondos de pantalla) y carátulas, en alta calidad. */
  backdrops: { path: string; aspect: number }[];
  posters: string[];
};

type RawVideo = { key: string; site: string; type: string; name?: string; official?: boolean; iso_639_1?: string };
type RawCredits = {
  cast?: { id: number; name: string; character?: string; profile_path: string | null; roles?: { character: string }[] }[];
  crew?: { name: string; job: string }[];
};
type RawExtras = {
  original_title?: string;
  original_name?: string;
  original_language?: string;
  homepage?: string;
  vote_count?: number;
  created_by?: { name: string }[];
  networks?: { name: string }[];
  credits?: RawCredits;
  aggregate_credits?: RawCredits;
  videos?: { results: RawVideo[] };
  recommendations?: { results: Omit<TmdbSearchResult, 'media_type'>[] };
  external_ids?: { imdb_id?: string | null };
  imdb_id?: string | null;
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  images?: { posters?: RawImage[]; backdrops?: RawImage[]; logos?: RawImage[] };
};

const EMPTY_EXTRAS: TitleExtras = {
  cast: [],
  makers: [],
  trailerKey: null,
  recommendations: [],
  imdbId: null,
  certification: null,
  networks: [],
  originalTitle: null,
  originalLanguage: null,
  homepage: null,
  voteCount: 0,
  poster: null,
  backdrop: null,
  logo: null,
  logoAspect: 3,
  videos: [],
  backdrops: [],
  posters: [],
};

const IMAGE_LANGS = 'en,null,es,ja,ko,fr,de,it,pt,hi,zh,tr,sv,da,no';

/** Solo la carátula original de un título (para corregir las guardadas con letreros). */
export async function getOriginalPoster(type: MediaType, id: number): Promise<string | null> {
  if (isDemo) return null;
  const raw = await get<{ original_language?: string; images?: { posters?: RawImage[] } }>(`/${type}/${id}`, {
    append_to_response: 'images',
    include_image_language: IMAGE_LANGS,
  });
  return bestPoster(raw.images?.posters, raw.original_language);
}

export async function getExtras(type: MediaType, id: number): Promise<TitleExtras> {
  if (isDemo) return EMPTY_EXTRAS;
  const append =
    type === 'tv'
      ? 'aggregate_credits,videos,recommendations,external_ids,content_ratings,images'
      : 'credits,videos,recommendations,external_ids,release_dates,images';
  const raw = await get<RawExtras>(`/${type}/${id}`, {
    append_to_response: append,
    // Tráileres en español primero; si no hay, en inglés o sin idioma.
    include_video_language: 'es,en,null',
    include_image_language: IMAGE_LANGS,
  });
  // Las recomendaciones vienen anidadas: se limpian sus carátulas aparte.
  if (raw.recommendations) await cleanListPosters(`/${type}/${id}/recommendations`, {}, raw.recommendations);
  const credits = raw.aggregate_credits ?? raw.credits;
  const cast = (credits?.cast ?? []).slice(0, 20).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character ?? c.roles?.[0]?.character ?? '',
    profilePath: c.profile_path,
  }));
  const makers =
    type === 'tv'
      ? (raw.created_by ?? []).map((c) => c.name)
      : (credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
  const videos = (raw.videos?.results ?? []).filter((v) => v.site === 'YouTube');
  const rank = (v: RawVideo) =>
    (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) + (v.iso_639_1 === 'es' ? 0 : 1) + (v.official ? 0 : 0.5);
  const trailer = [...videos].sort((a, b) => rank(a) - rank(b))[0];
  const cert =
    type === 'tv'
      ? (raw.content_ratings?.results.find((r) => r.iso_3166_1 === REGION) ??
          raw.content_ratings?.results.find((r) => r.iso_3166_1 === 'US'))?.rating
      : (raw.release_dates?.results.find((r) => r.iso_3166_1 === REGION) ??
          raw.release_dates?.results.find((r) => r.iso_3166_1 === 'US'))?.release_dates.find((d) => d.certification)
          ?.certification;
  return {
    cast,
    makers,
    trailerKey: trailer?.key ?? null,
    recommendations: (raw.recommendations?.results ?? []).slice(0, 18).map((r) => ({ ...r, media_type: type })),
    imdbId: raw.external_ids?.imdb_id ?? raw.imdb_id ?? null,
    certification: cert || null,
    networks: (raw.networks ?? []).map((n) => n.name),
    originalTitle: raw.original_title ?? raw.original_name ?? null,
    originalLanguage: raw.original_language ?? null,
    homepage: raw.homepage || null,
    voteCount: raw.vote_count ?? 0,
    poster: bestPoster(raw.images?.posters, raw.original_language),
    videos: [...videos]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 16)
      .map((v) => ({ key: v.key, name: v.name ?? v.type, type: v.type })),
    backdrops: (raw.images?.backdrops ?? [])
      .filter((b) => b.iso_639_1 === null)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 30)
      .map((b) => ({ path: b.file_path, aspect: b.aspect_ratio || 16 / 9 })),
    posters: (raw.images?.posters ?? []).slice(0, 20).map((p) => p.file_path),
    backdrop: raw.images?.backdrops?.find((b) => b.iso_639_1 === null)?.file_path ?? null,
    ...(() => {
      const l = raw.images?.logos?.find((x) => x.iso_639_1 === 'es') ?? raw.images?.logos?.find((x) => x.iso_639_1 === 'en');
      return { logo: l?.file_path ?? null, logoAspect: l?.aspect_ratio || 3 };
    })(),
  };
}

export type Person = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  department: string | null;
  profilePath: string | null;
  credits: (TmdbSearchResult & { character?: string })[];
};

export async function getPerson(id: number): Promise<Person> {
  if (isDemo) throw new TmdbError('Las páginas de actores necesitan conexión con TMDB.', 404);
  type Raw = {
    id: number;
    name: string;
    biography: string;
    birthday: string | null;
    deathday: string | null;
    place_of_birth: string | null;
    known_for_department: string | null;
    profile_path: string | null;
    combined_credits?: { cast: (TmdbSearchResult & { character?: string; vote_count?: number; popularity?: number })[] };
  };
  const raw = await get<Raw>(`/person/${id}`, { append_to_response: 'combined_credits' });
  // Sin biografía en español, se usa la de inglés.
  let bio = raw.biography;
  if (!bio) {
    const en = await get<{ biography: string }>(`/person/${id}`, { language: 'en-US' });
    bio = en.biography;
  }
  const seen = new Set<string>();
  const credits = (raw.combined_credits?.cast ?? [])
    .filter((c) => (c.media_type === 'movie' || c.media_type === 'tv') && (c.vote_count ?? 0) > 20)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .filter((c) => {
      const k = `${c.media_type}:${c.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 40);
  return {
    id: raw.id,
    name: raw.name,
    biography: bio,
    birthday: raw.birthday,
    deathday: raw.deathday,
    placeOfBirth: raw.place_of_birth,
    department: raw.known_for_department,
    profilePath: raw.profile_path,
    credits,
  };
}

// --- Descubrir ---

export type Shelf = 'trending_day' | 'popular' | 'top_rated' | 'anticipated' | 'on_air';

/** Estantes de Descubrir. type 'all' mezcla series y películas. */
export async function getShelf(shelf: Shelf, type: MediaType | 'all' = 'all'): Promise<TmdbSearchResult[]> {
  if (isDemo) return shelf === 'trending_day' ? demoTrending() : [];
  const tag = <T extends Omit<TmdbSearchResult, 'media_type'>>(t: MediaType, r: T[]) =>
    r.map((x) => ({ ...x, media_type: t })) as TmdbSearchResult[];
  const both = async (fn: (t: MediaType) => Promise<TmdbSearchResult[]>) => {
    if (type !== 'all') return fn(type);
    const [m, t] = await Promise.all([fn('movie'), fn('tv')]);
    // Intercala para que no queden todas las películas primero.
    const out: TmdbSearchResult[] = [];
    for (let i = 0; i < Math.max(m.length, t.length); i++) {
      if (t[i]) out.push(t[i]);
      if (m[i]) out.push(m[i]);
    }
    return out;
  };
  const today = new Date().toISOString().slice(0, 10);
  switch (shelf) {
    case 'trending_day': {
      const path = type === 'all' ? '/trending/all/day' : `/trending/${type}/day`;
      const d = await get<{ results: TmdbSearchResult[] }>(path);
      return d.results
        .map((r) => ({ ...r, media_type: r.media_type ?? (type as MediaType) }))
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
    }
    case 'popular':
      return both(async (t) => tag(t, (await get<{ results: never[] }>(`/${t}/popular`, { region: REGION })).results));
    case 'top_rated':
      return both(async (t) => tag(t, (await get<{ results: never[] }>(`/${t}/top_rated`)).results));
    case 'on_air':
      return tag('tv', (await get<{ results: never[] }>('/tv/on_the_air')).results);
    case 'anticipated':
      // Lo más popular que aún no se estrena.
      return both(async (t) =>
        tag(
          t,
          (
            await get<{ results: never[] }>(`/discover/${t}`, {
              sort_by: 'popularity.desc',
              [t === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte']: today,
              include_adult: 'false',
            })
          ).results,
        ),
      );
  }
}

export type DiscoverFilters = {
  type: MediaType;
  genres: number[];
  fromYear: number | null;
  toYear: number | null;
  minRating: number;
  maxRuntime: number | null;
  providers: number[];
  sort: 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc';
};

export const DEFAULT_DISCOVER: DiscoverFilters = {
  type: 'tv',
  genres: [],
  fromYear: null,
  toYear: null,
  minRating: 0,
  maxRuntime: null,
  providers: [],
  sort: 'popularity.desc',
};

/** Búsqueda avanzada con filtros combinados (géneros, años, nota mínima, duración, plataformas). */
export async function discover(f: DiscoverFilters, page = 1): Promise<{ results: TmdbSearchResult[]; totalPages: number }> {
  if (isDemo) return { results: demoTrending().filter((r) => r.media_type === f.type), totalPages: 1 };
  const date = f.type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const params: Record<string, string> = {
    page: String(page),
    include_adult: 'false',
    sort_by: f.sort === 'primary_release_date.desc' ? `${date}.desc` : f.sort,
    'vote_count.gte': f.sort === 'vote_average.desc' ? '200' : '20',
  };
  if (f.genres.length) params.with_genres = f.genres.join(',');
  if (f.fromYear) params[`${date}.gte`] = `${f.fromYear}-01-01`;
  if (f.toYear) params[`${date}.lte`] = `${f.toYear}-12-31`;
  if (f.minRating) params['vote_average.gte'] = String(f.minRating);
  if (f.maxRuntime) params['with_runtime.lte'] = String(f.maxRuntime);
  if (f.providers.length) {
    params.with_watch_providers = f.providers.join('|');
    params.watch_region = REGION;
    params.with_watch_monetization_types = 'flatrate|free|ads';
  }
  const d = await get<{ results: Omit<TmdbSearchResult, 'media_type'>[]; total_pages: number }>(`/discover/${f.type}`, params);
  return { results: d.results.map((r) => ({ ...r, media_type: f.type })), totalPages: d.total_pages };
}

export async function getGenres(type: MediaType): Promise<{ id: number; name: string }[]> {
  if (isDemo) return [];
  return (await get<{ genres: { id: number; name: string }[] }>(`/genre/${type}/list`)).genres;
}
