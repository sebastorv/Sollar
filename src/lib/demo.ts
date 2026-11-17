/**
 * Catálogo de demostración. Se usa cuando no hay token de TMDB, para que la app
 * se pueda probar de inmediato (y para la vista previa web). Son títulos reales con
 * su número de temporadas y episodios; los nombres de episodio son genéricos y las
 * sinopsis son resúmenes propios. Sin carátulas: se muestran tarjetas de color.
 *
 * Las fechas de los episodios que vienen se calculan a partir de hoy, para que el
 * calendario tenga algo que mostrar. Son de ejemplo, no son fechas reales.
 */

import { addDays, todayISO } from './dates';

import type {
  ProviderInfo,
  TmdbEpisode,
  TmdbMovie,
  TmdbSearchResult,
  TmdbSeason,
  TmdbTv,
  TmdbWatchProviders,
} from './types';

type DemoShow = {
  id: number;
  name: string;
  year: number;
  genres: string[];
  overview: string;
  runtime: number;
  seasons: number[]; // episodios por temporada
  status: string;
  /** Temporada en emisión: desde qué episodio faltan por salir y en cuántos días sale el primero. */
  airing?: { season: number; from: number; inDays: number };
};

type DemoMovie = {
  id: number;
  title: string;
  year: number;
  genres: string[];
  overview: string;
  runtime: number;
};

// Ids altos para no chocar con ids reales de TMDB si luego se conecta el token.
const SHOWS: DemoShow[] = [
  {
    id: 900001,
    name: 'From',
    year: 2022,
    genres: ['Misterio', 'Terror', 'Drama'],
    overview:
      'Un pueblo del que nadie puede salir atrapa a quienes llegan por su única carretera. Cada noche, criaturas con forma humana salen a cazar.',
    runtime: 52,
    seasons: [10, 10, 10],
    status: 'En emisión',
    airing: { season: 3, from: 7, inDays: 2 },
  },
  {
    id: 900002,
    name: 'Severance',
    year: 2022,
    genres: ['Drama', 'Misterio', 'Ciencia ficción'],
    overview:
      'Los empleados de Lumon se someten a un procedimiento que separa sus recuerdos del trabajo de los de su vida personal.',
    runtime: 50,
    seasons: [9, 10, 10],
    status: 'En emisión',
    airing: { season: 3, from: 1, inDays: 5 },
  },
  {
    id: 900003,
    name: 'The Last of Us',
    year: 2023,
    genres: ['Drama', 'Acción', 'Ciencia ficción'],
    overview:
      'Veinte años después de una pandemia causada por un hongo, un contrabandista debe cruzar Estados Unidos escoltando a una adolescente.',
    runtime: 55,
    seasons: [9, 7, 8],
    status: 'En emisión',
    airing: { season: 3, from: 1, inDays: 19 },
  },
  {
    id: 900004,
    name: 'Breaking Bad',
    year: 2008,
    genres: ['Drama', 'Crimen'],
    overview:
      'Un profesor de química con un diagnóstico grave empieza a fabricar metanfetamina para asegurar el futuro de su familia.',
    runtime: 47,
    seasons: [7, 13, 13, 13, 16],
    status: 'Finalizada',
  },
  {
    id: 900005,
    name: 'Dark',
    year: 2017,
    genres: ['Misterio', 'Ciencia ficción', 'Drama'],
    overview:
      'La desaparición de dos niños en un pueblo alemán revela los secretos de cuatro familias unidas por un ciclo que atraviesa el tiempo.',
    runtime: 55,
    seasons: [10, 8, 8],
    status: 'Finalizada',
  },
  {
    id: 900006,
    name: 'Stranger Things',
    year: 2016,
    genres: ['Ciencia ficción', 'Misterio', 'Drama'],
    overview:
      'En un pueblo de Indiana, un grupo de amigos busca a un niño desaparecido y se encuentra con experimentos secretos y una niña con poderes.',
    runtime: 60,
    seasons: [8, 9, 8, 9, 8],
    status: 'Finalizada',
  },
];

const MOVIES: DemoMovie[] = [
  {
    id: 910001,
    title: 'Dune: Parte dos',
    year: 2024,
    genres: ['Ciencia ficción', 'Aventura'],
    overview: 'Paul Atreides se une a los Fremen para vengar a su familia mientras intenta evitar un futuro terrible.',
    runtime: 166,
  },
  {
    id: 910002,
    title: 'Oppenheimer',
    year: 2023,
    genres: ['Drama', 'Historia'],
    overview: 'La historia del físico que dirigió el proyecto que creó la bomba atómica, y de lo que vino después.',
    runtime: 180,
  },
  {
    id: 910003,
    title: 'La sociedad de la nieve',
    year: 2023,
    genres: ['Drama', 'Historia'],
    overview: 'Los sobrevivientes de un accidente aéreo en los Andes luchan durante semanas por mantenerse con vida.',
    runtime: 144,
  },
  {
    id: 910004,
    title: 'Interstellar',
    year: 2014,
    genres: ['Ciencia ficción', 'Drama', 'Aventura'],
    overview:
      'Un grupo de astronautas viaja a través de un agujero de gusano en busca de un nuevo hogar para la humanidad.',
    runtime: 169,
  },
  {
    id: 910005,
    title: 'Coco',
    year: 2017,
    genres: ['Animación', 'Familia', 'Fantasía'],
    overview:
      'Miguel sueña con ser músico y, en el Día de Muertos, termina en la Tierra de los Muertos buscando a su tatarabuelo.',
    runtime: 105,
  },
  {
    id: 910006,
    title: 'Encanto',
    year: 2021,
    genres: ['Animación', 'Familia', 'Comedia'],
    overview:
      'En una casa mágica escondida en las montañas de Colombia, Mirabel es la única de la familia Madrigal sin un don.',
    runtime: 102,
  },
];

const genre = (name: string, i: number) => ({ id: i + 1, name });

/** Fecha interna "ya emitido" para los episodios de ejemplo. No se muestra en pantalla. */
export const DEMO_AIRED = '1970-01-01';

function showToResult(s: DemoShow): TmdbSearchResult {
  return {
    id: s.id,
    media_type: 'tv',
    name: s.name,
    poster_path: null,
    backdrop_path: null,
    first_air_date: `${s.year}-01-01`,
    overview: s.overview,
    vote_average: 0,
  };
}

function movieToResult(m: DemoMovie): TmdbSearchResult {
  return {
    id: m.id,
    media_type: 'movie',
    title: m.title,
    poster_path: null,
    backdrop_path: null,
    release_date: `${m.year}-01-01`,
    overview: m.overview,
    vote_average: 0,
  };
}

/** Quita tildes y pasa a minúsculas para buscar "sociedad" o "pelicula" sin importar acentos. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function demoSearch(query: string): TmdbSearchResult[] {
  const q = normalize(query.trim());
  const all = [...SHOWS.map(showToResult), ...MOVIES.map(movieToResult)];
  return all.filter((r) => normalize(r.title ?? r.name ?? '').includes(q));
}

export function demoTrending(): TmdbSearchResult[] {
  // Intercala series y películas para que la portada se vea variada.
  const out: TmdbSearchResult[] = [];
  for (let i = 0; i < Math.max(SHOWS.length, MOVIES.length); i++) {
    if (SHOWS[i]) out.push(showToResult(SHOWS[i]));
    if (MOVIES[i]) out.push(movieToResult(MOVIES[i]));
  }
  return out;
}

export function demoMovie(id: number): TmdbMovie | null {
  const m = MOVIES.find((x) => x.id === id);
  if (!m) return null;
  return {
    id: m.id,
    title: m.title,
    overview: m.overview,
    poster_path: null,
    backdrop_path: null,
    release_date: `${m.year}-01-01`,
    runtime: m.runtime,
    genres: m.genres.map(genre),
    vote_average: 0,
    tagline: null,
  };
}

export function demoTv(id: number): TmdbTv | null {
  const s = SHOWS.find((x) => x.id === id);
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    overview: s.overview,
    poster_path: null,
    backdrop_path: null,
    first_air_date: `${s.year}-01-01`,
    episode_run_time: [s.runtime],
    genres: s.genres.map(genre),
    vote_average: 0,
    tagline: null,
    status: s.status,
    number_of_seasons: s.seasons.length,
    number_of_episodes: s.seasons.reduce((a, b) => a + b, 0),
    seasons: s.seasons.map((count, i) => ({
      season_number: i + 1,
      episode_count: count,
      name: `Temporada ${i + 1}`,
      air_date: null,
    })),
    next_episode_to_air: demoNextEpisode(s),
  };
}

/** Fecha de emisión de un episodio de ejemplo: semanal, alrededor del episodio que viene. */
function demoAirDate(s: DemoShow, season: number, episode: number): string {
  const a = s.airing;
  if (!a || season < a.season) return DEMO_AIRED;
  if (season > a.season) return addDays(todayISO(), a.inDays + 365);
  return addDays(todayISO(), a.inDays + (episode - a.from) * 7);
}

function demoEpisodeType(s: DemoShow, season: number, episode: number): string {
  return episode === s.seasons[season - 1] ? 'finale' : 'standard';
}

function demoNextEpisode(s: DemoShow): TmdbTv['next_episode_to_air'] {
  const a = s.airing;
  if (!a) return null;
  return {
    season_number: a.season,
    episode_number: a.from,
    air_date: demoAirDate(s, a.season, a.from),
    name: `Episodio ${a.from}`,
    episode_type: demoEpisodeType(s, a.season, a.from),
  };
}

export function demoSeason(tvId: number, season: number): TmdbSeason | null {
  const s = SHOWS.find((x) => x.id === tvId);
  const count = s?.seasons[season - 1];
  if (!s || !count) return null;
  const episodes: TmdbEpisode[] = Array.from({ length: count }, (_, i) => ({
    id: tvId * 1000 + season * 100 + i + 1,
    episode_number: i + 1,
    season_number: season,
    name: `Episodio ${i + 1}`,
    overview: '',
    air_date: demoAirDate(s, season, i + 1),
    runtime: s.runtime,
    still_path: null,
    episode_type: demoEpisodeType(s, season, i + 1),
  }));
  return { id: tvId * 10 + season, season_number: season, name: `Temporada ${season}`, episodes };
}

// --- Plataformas de ejemplo ---
// Ids de TMDB. Solo se asignan a producciones propias de cada plataforma, que es
// donde la disponibilidad es estable; el resto queda sin plataforma a propósito.

export const DEMO_PROVIDERS: ProviderInfo[] = [
  { id: 8, name: 'Netflix', logoPath: null },
  { id: 119, name: 'Amazon Prime Video', logoPath: null },
  { id: 337, name: 'Disney Plus', logoPath: null },
  { id: 1899, name: 'HBO Max', logoPath: null },
  { id: 350, name: 'Apple TV+', logoPath: null },
  { id: 531, name: 'Paramount Plus', logoPath: null },
  { id: 283, name: 'Crunchyroll', logoPath: null },
  { id: 11, name: 'MUBI', logoPath: null },
];

const DEMO_AVAILABILITY: Record<number, number[]> = {
  900005: [8], // Dark
  900006: [8], // Stranger Things
  910003: [8], // La sociedad de la nieve
  900002: [350], // Severance
  900003: [1899], // The Last of Us
  910005: [337], // Coco
  910006: [337], // Encanto
};

export function demoWatchProviders(id: number): TmdbWatchProviders | null {
  const ids = DEMO_AVAILABILITY[id];
  if (!ids) return null;
  return {
    flatrate: ids.map((pid) => {
      const p = DEMO_PROVIDERS.find((x) => x.id === pid)!;
      return { provider_id: p.id, provider_name: p.name, logo_path: '' };
    }),
  };
}

/** Títulos del catálogo que están en alguna de las plataformas dadas. */
export function demoOnProviders(providerIds: number[]): TmdbSearchResult[] {
  const set = new Set(providerIds);
  return demoTrending().filter((r) => (DEMO_AVAILABILITY[r.id] ?? []).some((id) => set.has(id)));
}
