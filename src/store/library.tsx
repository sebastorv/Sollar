/**
 * Biblioteca del usuario: estado global + persistencia local.
 *
 * Todo se guarda en el dispositivo (AsyncStorage; en web, localStorage), así la app abre al
 * instante y funciona sin conexión. Con cuenta, store/sync.tsx sube y baja los cambios.
 *
 * Al borrar un título queda una marca de borrado (tombstones) para que el borrado también
 * llegue a los demás dispositivos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { RemoteRow } from '@/lib/cloud';
import { nextEpisode } from '@/lib/progress';
import {
  episodeKey,
  type Availability,
  type BackupFile,
  type LibraryItem,
  type SeasonSummary,
  type WatchStatus,
} from '@/lib/types';

const STORAGE_KEY = 'sollar.library.v1';
/** Clave de cuando la app se llamaba Butaca: se lee una vez para no perder la lista. */
const OLD_STORAGE_KEY = 'butaca.library.v1';
const TOMBSTONES_KEY = 'sollar.deleted.v1';

type State = {
  ready: boolean;
  items: Record<string, LibraryItem>;
  /** Títulos borrados, con la fecha del borrado. */
  tombstones: Record<string, string>;
};

type Action =
  | { type: 'hydrate'; items: Record<string, LibraryItem>; tombstones: Record<string, string> }
  | { type: 'remote'; rows: RemoteRow[] }
  | { type: 'upsert'; item: LibraryItem }
  | { type: 'remove'; key: string }
  | { type: 'patch'; key: string; patch: Partial<LibraryItem> }
  | { type: 'setEpisodes'; key: string; episodes: { season: number; episode: number }[]; watched: boolean }
  | { type: 'refreshSeasons'; key: string; seasons: SeasonSummary[] }
  | { type: 'availability'; key: string; availability: Availability }
  | { type: 'import'; items: LibraryItem[]; mode: 'merge' | 'replace' };

function touch(item: LibraryItem, patch: Partial<LibraryItem>): LibraryItem {
  return { ...item, ...patch, updatedAt: new Date().toISOString() };
}

/** Ajusta el estado de una serie según su progreso, sin pisar decisiones del usuario. */
function autoStatus(item: LibraryItem): WatchStatus {
  const anyWatched = Object.keys(item.watchedEpisodes).length > 0;
  const upToDate = nextEpisode(item) === null && item.seasons.length > 0;
  // "En pausa" y "Abandonada" son decisiones del usuario: no se tocan.
  if (item.status === 'paused' || item.status === 'dropped') return item.status;
  if (upToDate && anyWatched) return 'completed';
  if (item.status === 'completed' && !upToDate) return 'watching';
  if (item.status === 'planned' && anyWatched) return 'watching';
  return item.status;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ready: true, items: action.items, tombstones: action.tombstones };

    case 'upsert': {
      const { [action.item.key]: _gone, ...tombstones } = state.tombstones;
      return { ...state, tombstones, items: { ...state.items, [action.item.key]: action.item } };
    }

    case 'remove': {
      const { [action.key]: _removed, ...rest } = state.items;
      return { ...state, items: rest, tombstones: { ...state.tombstones, [action.key]: new Date().toISOString() } };
    }

    case 'remote': {
      // Cambios que llegan de otro dispositivo: se aplican solo si son más recientes.
      const items = { ...state.items };
      const tombstones = { ...state.tombstones };
      let changed = false;
      for (const row of action.rows) {
        const local = items[row.key];
        const localTime = local?.updatedAt ?? tombstones[row.key] ?? '';
        if (row.deleted) {
          if (local && localTime <= row.client_updated_at) {
            delete items[row.key];
            tombstones[row.key] = row.client_updated_at;
            changed = true;
          }
        } else if (row.data && localTime < row.data.updatedAt) {
          // La disponibilidad es un dato del dispositivo: se conserva si la remota no la trae.
          items[row.key] = { ...row.data, availability: row.data.availability ?? local?.availability ?? null };
          delete tombstones[row.key];
          changed = true;
        }
      }
      return changed ? { ...state, items, tombstones } : state;
    }

    case 'patch': {
      const item = state.items[action.key];
      if (!item) return state;
      return { ...state, items: { ...state.items, [action.key]: touch(item, action.patch) } };
    }

    case 'setEpisodes': {
      const item = state.items[action.key];
      if (!item) return state;
      const watchedEpisodes = { ...item.watchedEpisodes };
      const now = new Date().toISOString();
      for (const { season, episode } of action.episodes) {
        const k = episodeKey(season, episode);
        if (action.watched) watchedEpisodes[k] = watchedEpisodes[k] ?? now;
        else delete watchedEpisodes[k];
      }
      const next = touch(item, { watchedEpisodes });
      return { ...state, items: { ...state.items, [action.key]: { ...next, status: autoStatus(next) } } };
    }

    case 'refreshSeasons': {
      const item = state.items[action.key];
      if (!item) return state;
      const next = { ...item, seasons: action.seasons };
      // Si salió una temporada nueva, una serie "Vista" vuelve a "Viendo".
      return { ...state, items: { ...state.items, [action.key]: { ...next, status: autoStatus(next) } } };
    }

    case 'availability': {
      const item = state.items[action.key];
      if (!item) return state;
      // No cambia updatedAt: es un dato de TMDB, no una decisión del usuario.
      return { ...state, items: { ...state.items, [action.key]: { ...item, availability: action.availability } } };
    }

    case 'import': {
      const incoming = Object.fromEntries(action.items.map((i) => [i.key, i]));
      if (action.mode === 'replace') {
        // Lo que no viene en el respaldo queda como borrado, también en los demás dispositivos.
        const now = new Date().toISOString();
        const tombstones = { ...state.tombstones };
        for (const k of Object.keys(state.items)) if (!incoming[k]) tombstones[k] = now;
        return { ...state, items: incoming, tombstones };
      }
      // Al combinar, gana la versión modificada más recientemente.
      const merged = { ...state.items };
      for (const it of action.items) {
        const current = merged[it.key];
        if (!current || current.updatedAt < it.updatedAt) merged[it.key] = it;
      }
      return { ...state, items: merged };
    }
  }
}

type LibraryApi = {
  ready: boolean;
  items: LibraryItem[];
  /** Para la sincronización: todo el estado y la forma de aplicar cambios remotos. */
  raw: { items: Record<string, LibraryItem>; tombstones: Record<string, string> };
  applyRemote: (rows: RemoteRow[]) => void;
  get: (key: string) => LibraryItem | undefined;
  save: (item: LibraryItem) => void;
  remove: (key: string) => void;
  setStatus: (key: string, status: WatchStatus) => void;
  setRating: (key: string, rating: number | null) => void;
  setNote: (key: string, note: string) => void;
  setMovieWatched: (key: string, watched: boolean) => void;
  setEpisodes: (key: string, episodes: { season: number; episode: number }[], watched: boolean) => void;
  refreshSeasons: (key: string, seasons: SeasonSummary[]) => void;
  setAvailability: (key: string, availability: Availability) => void;
  exportBackup: () => BackupFile;
  importBackup: (backup: BackupFile, mode: 'merge' | 'replace') => void;
};

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ready: false, items: {}, tombstones: {} });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar al iniciar.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY).then((raw) => raw ?? AsyncStorage.getItem(OLD_STORAGE_KEY)),
      AsyncStorage.getItem(TOMBSTONES_KEY),
    ])
      .then(([raw, dead]) => {
        const items = raw ? (JSON.parse(raw) as Record<string, LibraryItem>) : {};
        const tombstones = dead ? (JSON.parse(dead) as Record<string, string>) : {};
        dispatch({ type: 'hydrate', items, tombstones });
      })
      .catch(() => dispatch({ type: 'hydrate', items: {}, tombstones: {} }));
  }, []);

  // Guardar con un pequeño retraso para agrupar cambios seguidos (marcar varios episodios).
  useEffect(() => {
    if (!state.ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)).catch(() => {});
      AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(state.tombstones)).catch(() => {});
    }, 300);
  }, [state]);

  const get = useCallback((key: string) => state.items[key], [state.items]);

  const api = useMemo<LibraryApi>(
    () => ({
      ready: state.ready,
      raw: { items: state.items, tombstones: state.tombstones },
      applyRemote: (rows) => dispatch({ type: 'remote', rows }),
      items: Object.values(state.items).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      get,
      save: (item) => dispatch({ type: 'upsert', item }),
      remove: (key) => dispatch({ type: 'remove', key }),
      setStatus: (key, status) => {
        const item = state.items[key];
        const patch: Partial<LibraryItem> = { status };
        // Marcar una película como "Vista" registra la fecha.
        if (item?.mediaType === 'movie') {
          patch.watchedAt = status === 'completed' ? (item.watchedAt ?? new Date().toISOString()) : null;
        }
        dispatch({ type: 'patch', key, patch });
      },
      setRating: (key, rating) => dispatch({ type: 'patch', key, patch: { rating } }),
      setNote: (key, note) => dispatch({ type: 'patch', key, patch: { note } }),
      setMovieWatched: (key, watched) =>
        dispatch({
          type: 'patch',
          key,
          patch: watched
            ? { watchedAt: new Date().toISOString(), status: 'completed' }
            : { watchedAt: null, status: 'planned' },
        }),
      setEpisodes: (key, episodes, watched) => dispatch({ type: 'setEpisodes', key, episodes, watched }),
      refreshSeasons: (key, seasons) => dispatch({ type: 'refreshSeasons', key, seasons }),
      setAvailability: (key, availability) => dispatch({ type: 'availability', key, availability }),
      exportBackup: () => ({
        app: 'sollar',
        version: 1,
        exportedAt: new Date().toISOString(),
        items: Object.values(state.items),
      }),
      importBackup: (backup, mode) => dispatch({ type: 'import', items: backup.items, mode }),
    }),
    [state, get],
  );

  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary debe usarse dentro de <LibraryProvider>.');
  return ctx;
}
