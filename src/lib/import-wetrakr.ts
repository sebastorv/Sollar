/**
 * Importar el historial exportado desde WeTrakr (archivos CSV).
 *
 * Se usan:
 * - tracklog.csv: películas vistas o por ver, estado de cada serie y cada episodio visto con su fecha.
 * - ratings.csv: calificaciones de 1 a 10 de películas y series (las medias se redondean).
 * Las listas personalizadas y los favoritos se guardan para cuando Sollar tenga listas propias.
 *
 * Los CSV traen el identificador de TMDB de cada título, así que no hay que adivinar nada:
 * después se piden a TMDB la carátula, las temporadas y la duración de cada uno.
 */

import { episodeKey, type WatchStatus } from './types';

export type ImportedMovie = {
  tmdbId: number;
  title: string;
  status: WatchStatus;
  watchedAt: string | null;
  rating: number | null;
  addedAt: string;
};

export type ImportedShow = {
  tmdbId: number;
  title: string;
  status: WatchStatus | null;
  episodes: Record<string, string>;
  rating: number | null;
  addedAt: string;
};

export type ImportPlan = {
  movies: ImportedMovie[];
  shows: ImportedShow[];
  episodes: number;
  ratings: number;
  /** Archivos reconocidos, para mostrarlos en pantalla. */
  files: string[];
};

/** Lector de CSV que respeta comillas, comas y saltos de línea dentro de los campos. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const SHOW_STATUS: Record<string, WatchStatus> = {
  planning: 'planned',
  watching: 'watching',
  // "Esperando" en WeTrakr: va al día y espera episodios nuevos.
  waiting: 'watching',
  watched: 'completed',
  paused: 'paused',
  on_hold: 'paused',
  dropped: 'dropped',
};

function rating(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function earliest(a: string | undefined, b: string): string {
  return !a || b < a ? b : a;
}

/** Arma el plan de importación a partir de los CSV (nombre y contenido de cada archivo). */
export function planFromWetrakr(files: { name: string; text: string }[]): ImportPlan {
  const byName = (part: string) => files.find((f) => f.name.toLowerCase().includes(part));
  const track = byName('tracklog');
  if (!track) {
    throw new Error('No encontré tracklog.csv. Es el archivo con tu historial: inclúyelo en la selección.');
  }
  const movies = new Map<number, ImportedMovie>();
  const shows = new Map<number, ImportedShow>();
  let episodes = 0;
  const now = new Date().toISOString();

  const showFor = (id: number, title: string): ImportedShow => {
    let s = shows.get(id);
    if (!s) {
      s = { tmdbId: id, title, status: null, episodes: {}, rating: null, addedAt: now };
      shows.set(id, s);
    }
    if (!s.title && title) s.title = title;
    return s;
  };

  for (const r of parseCsv(track.text)) {
    const when = r.tracked_at || r.updated_at || now;
    if (r.type === 'movie') {
      const id = Number(r.tmdb_id);
      if (!id) continue;
      const prev = movies.get(id);
      const watched = r.status === 'watched';
      if (prev?.status === 'completed' && !watched) continue;
      movies.set(id, {
        tmdbId: id,
        title: r.title,
        status: watched ? 'completed' : 'planned',
        watchedAt: watched ? earliest(prev?.watchedAt ?? undefined, when) : null,
        rating: prev?.rating ?? null,
        addedAt: earliest(prev?.addedAt, when),
      });
    } else if (r.type === 'show') {
      const id = Number(r.tmdb_id);
      if (!id) continue;
      const s = showFor(id, r.title);
      s.status = SHOW_STATUS[r.status] ?? s.status;
      s.addedAt = earliest(s.addedAt === now ? undefined : s.addedAt, when);
    } else if (r.type === 'episode') {
      const id = Number(r.show_tmdb_id);
      const season = Number(r.season_number);
      const ep = Number(r.episode_number);
      if (!id || !season || !ep || r.status !== 'watched') continue;
      const s = showFor(id, r.show_title);
      const k = episodeKey(season, ep);
      if (!s.episodes[k]) episodes++;
      s.episodes[k] = earliest(s.episodes[k], when);
    }
  }

  let ratings = 0;
  const rated = byName('ratings');
  if (rated) {
    for (const r of parseCsv(rated.text)) {
      const value = rating(r.rating);
      const id = Number(r.tmdb_id);
      if (!value || !id) continue;
      if (r.type === 'movie') {
        const m = movies.get(id) ?? {
          tmdbId: id,
          title: r.title,
          status: 'completed' as WatchStatus,
          watchedAt: r.rated_at || now,
          rating: null,
          addedAt: r.rated_at || now,
        };
        m.rating = value;
        movies.set(id, m);
        ratings++;
      } else if (r.type === 'show') {
        showFor(id, r.title).rating = value;
        ratings++;
      }
    }
  }

  // Series sin estado propio: si tienen episodios vistos, se están viendo.
  for (const s of shows.values()) {
    if (!s.status) s.status = Object.keys(s.episodes).length ? 'watching' : 'planned';
    // Se agregó cuando se marcó como serie o cuando se vio su primer episodio, lo que pasó antes.
    const first = Object.values(s.episodes).sort()[0];
    if (first && (s.addedAt === now || first < s.addedAt)) s.addedAt = first;
  }

  return {
    movies: [...movies.values()],
    shows: [...shows.values()],
    episodes,
    ratings,
    files: files.map((f) => f.name),
  };
}
