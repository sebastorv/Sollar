/** Tipos de dominio de Sollar. */

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

/** Una plataforma de streaming (Netflix, Disney+...). Los ids son los de TMDB. */
export type ProviderInfo = {
  id: number;
  name: string;
  logoPath: string | null;
};

/**
 * Dónde se puede ver un título en el país configurado, guardado junto al título
 * para filtrar sin conexión. Se actualiza al abrir la ficha o desde Mi lista.
 */
export type Availability = {
  checkedAt: string;
  /** Incluido en la suscripción. */
  flatrate: number[];
  /** Gratis, con o sin anuncios. */
  free: number[];
  rent: number[];
  buy: number[];
  /** Nombres de las plataformas, para mostrarlos sin consultar de nuevo. */
  names: Record<number, string>;
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
  /** Calificación personal de 1 a 10, con bolsas de palomitas. */
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
  /** Solo películas: cada vez que la volviste a ver (la primera está en watchedAt). */
  rewatches?: string[];
  /** Solo series: cuántas veces la terminaste antes de volver a empezarla. */
  completedRuns?: number;
  /** Marcado como favorito (corazón). */
  favorite?: boolean;
  /** Reacciones ("¿Cómo te sentiste?"): "title" para el título, "2:5" para un episodio. */
  reactions?: Record<string, string[]>;
  /** Notas de 1 a 10 por episodio, con la clave "temporada:episodio". */
  episodeRatings?: Record<string, number>;
  /** Dónde verlo (puede faltar en títulos guardados antes de esta función). */
  availability?: Availability | null;
  addedAt: string;
  updatedAt: string;
};

/** Formato del archivo de respaldo que la app exporta e importa. */
export type BackupFile = {
  /** 'butaca' en los respaldos hechos antes del cambio de nombre. */
  app: 'sollar' | 'butaca';
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
  popularity?: number;
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
  poster_path?: string | null;
  /** Promedio de votos de la temporada en TMDB (0 si no hay). */
  vote_average?: number;
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
  next_episode_to_air: TmdbEpisodeStub | null;
  last_episode_to_air?: TmdbEpisodeStub | null;
  last_air_date?: string | null;
};

/** Episodio resumido que TMDB incluye en la ficha de la serie. */
export type TmdbEpisodeStub = {
  season_number: number;
  episode_number: number;
  air_date: string;
  name?: string;
  /** 'standard', 'finale' o 'mid_season'. */
  episode_type?: string;
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
  episode_type?: string;
  vote_average?: number;
  crew?: { id: number; job: string; name: string }[];
  guest_stars?: { id: number; name: string; character: string; profile_path: string | null }[];
};

export type TmdbSeason = {
  id: number;
  season_number: number;
  air_date?: string | null;
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

/** Un título dentro de una lista propia. Guarda lo justo para mostrarlo sin consultar TMDB. */
export type ListEntry = {
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  year: string | null;
  addedAt: string;
};

/** Lista creada por la persona ("Series de los 90", "Para ver con mamá"...). */
export type CustomList = {
  id: string;
  name: string;
  description: string;
  /** En el orden que eligió la persona. */
  entries: ListEntry[];
  createdAt: string;
  updatedAt: string;
};
