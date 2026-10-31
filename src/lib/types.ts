/** Tipos de dominio de Butaca. */

export type MediaType = 'movie' | 'tv';

/** Estado de un título en la lista del usuario. */
export type WatchStatus = 'planned' | 'watching' | 'completed' | 'paused' | 'dropped';

export const STATUS_LABEL: Record<WatchStatus, string> = {
  planned: 'Quiero ver',
  watching: 'Viendo',
  completed: 'Vista',
  paused: 'En pausa',
  dropped: 'Abandonada',
};

/** Orden en que se muestran los estados en filtros y selectores. */
export const STATUS_ORDER: WatchStatus[] = ['watching', 'planned', 'completed', 'paused', 'dropped'];

/** Clave de episodio: "temporada:episodio", por ejemplo "2:5". */
export type EpisodeKey = `${number}:${number}`;

export function episodeKey(season: number, episode: number): EpisodeKey {
  return `${season}:${episode}`;
}

/** Resumen de una temporada guardado junto al título, para calcular progreso sin red. */
export type SeasonSummary = {
  seasonNumber: number;
  episodeCount: number;
  name: string;
};

/** Un título guardado en la biblioteca del usuario. */
export type LibraryItem = {
  /** Clave única: "movie:603" o "tv:1399". */
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
  genres: string[];
  status: WatchStatus;
  /** Calificación personal de 1 a 10 (en pasos de 1, se muestra como 5 estrellas con medias). */
  rating: number | null;
  note: string;
  /** Minutos: duración de la película o duración media del episodio. */
  runtime: number | null;
  /** Solo series: temporadas sin contar "Especiales" (temporada 0). */
  seasons: SeasonSummary[];
  /** Solo series: episodios vistos con la fecha en que se marcaron. */
  watchedEpisodes: Record<EpisodeKey, string>;
  /** Solo películas: fecha en que se marcó como vista. */
  watchedAt: string | null;
  addedAt: string;
  updatedAt: string;
};

/** Formato del archivo de respaldo que la app exporta e importa. */
export type BackupFile = {
  app: 'butaca';
  version: 1;
  exportedAt: string;
  items: LibraryItem[];
};

// --- Respuestas de TMDB (solo los campos que usamos) ---

export type TmdbSearchResult = {
  id: number;
  media_type: MediaType | 'person';
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
};

export type TmdbGenre = { id: number; name: string };

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: TmdbGenre[];
  vote_average: number;
  tagline: string | null;
};

export type TmdbSeasonStub = {
  season_number: number;
  episode_count: number;
  name: string;
  air_date: string | null;
};

export type TmdbTv = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  episode_run_time: number[];
  genres: TmdbGenre[];
  vote_average: number;
  tagline: string | null;
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeasonStub[];
  next_episode_to_air: { season_number: number; episode_number: number; air_date: string } | null;
};

export type TmdbEpisode = {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
};

export type TmdbSeason = {
  id: number;
  season_number: number;
  name: string;
  episodes: TmdbEpisode[];
};

export type TmdbProvider = { provider_id: number; provider_name: string; logo_path: string };

export type TmdbWatchProviders = {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
};
