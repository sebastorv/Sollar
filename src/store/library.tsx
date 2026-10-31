/**
 * Biblioteca del usuario: estado global + persistencia local.
 *
 * Fase 1 (este código): todo vive en el dispositivo (AsyncStorage; en web usa localStorage).
 * Fase 2: sincronizar con Supabase usando supabase/schema.sql. La interfaz de este
 * contexto (useLibrary) no tiene que cambiar; solo se añade la capa de sincronización.
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

import { nextEpisode } from '@/lib/progress';
import {
  episodeKey,
  type BackupFile,
  type LibraryItem,
  type SeasonSummary,
  type WatchStatus,
} from '@/lib/types';

const STORAGE_KEY = 'butaca.library.v1';

type State = { ready: boolean; items: Record<string, LibraryItem> };

type Action =
  | { type: 'hydrate'; items: Record<string, LibraryItem> }
  | { type: 'upsert'; item: LibraryItem }
  | { type: 'remove'; key: string }
  | { type: 'patch'; key: string; patch: Partial<LibraryItem> }
  | { type: 'setEpisodes'; key: string; episodes: { season: number; episode: number }[]; watched: boolean }
  | { type: 'refreshSeasons'; key: string; seasons: SeasonSummary[] }
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
      return { ready: true, items: action.items };

    case 'upsert':
      return { ...state, items: { ...state.items, [action.item.key]: action.item } };

    case 'remove': {
      const { [action.key]: _removed, ...rest } = state.items;
      return { ...state, items: rest };
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

    case 'import': {
      const incoming = Object.fromEntries(action.items.map((i) => [i.key, i]));
      if (action.mode === 'replace') return { ...state, items: incoming };
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
  get: (key: string) => LibraryItem | undefined;
  save: (item: LibraryItem) => void;
  remove: (key: string) => void;
  setStatus: (key: string, status: WatchStatus) => void;
  setRating: (key: string, rating: number | null) => void;
  setNote: (key: string, note: string) => void;
  setMovieWatched: (key: string, watched: boolean) => void;
  setEpisodes: (key: string, episodes: { season: number; episode: number }[], watched: boolean) => void;
  refreshSeasons: (key: string, seasons: SeasonSummary[]) => void;
  exportBackup: () => BackupFile;
  importBackup: (backup: BackupFile, mode: 'merge' | 'replace') => void;
};

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ready: false, items: {} });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar al iniciar.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const items = raw ? (JSON.parse(raw) as Record<string, LibraryItem>) : {};
        dispatch({ type: 'hydrate', items });
      })
      .catch(() => dispatch({ type: 'hydrate', items: {} }));
  }, []);

  // Guardar con un pequeño retraso para agrupar cambios seguidos (marcar varios episodios).
  useEffect(() => {
    if (!state.ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)).catch(() => {});
    }, 300);
  }, [state]);

  const get = useCallback((key: string) => state.items[key], [state.items]);

  const api = useMemo<LibraryApi>(
    () => ({
      ready: state.ready,
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
      exportBackup: () => ({
        app: 'butaca',
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
