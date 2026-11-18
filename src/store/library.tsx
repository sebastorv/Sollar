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
  type CustomList,
  type ListEntry,
  type LibraryItem,
  type SeasonSummary,
  type WatchStatus,
} from '@/lib/types';

const STORAGE_KEY = 'sollar.library.v1';
/** Clave de cuando la app se llamaba Butaca: se lee una vez para no perder la lista. */
const OLD_STORAGE_KEY = 'butaca.library.v1';
const TOMBSTONES_KEY = 'sollar.deleted.v1';
const LISTS_KEY = 'sollar.lists.v1';
/** Las listas viajan al servidor en la misma tabla que los títulos, con esta marca en la clave. */
export const LIST_PREFIX = 'list:';

type State = {
  ready: boolean;
  items: Record<string, LibraryItem>;
  /** Títulos borrados, con la fecha del borrado. */
  tombstones: Record<string, string>;
  lists: Record<string, CustomList>;
};

type Action =
  | {
      type: 'hydrate';
      items: Record<string, LibraryItem>;
      tombstones: Record<string, string>;
      lists: Record<string, CustomList>;
    }
  | { type: 'listPut'; list: CustomList }
  | { type: 'listDelete'; id: string }
  | { type: 'listsImported'; lists: CustomList[] }
  | { type: 'remote'; rows: RemoteRow[] }
  | { type: 'mergeImported'; items: LibraryItem[] }
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
      return { ready: true, items: action.items, tombstones: action.tombstones, lists: action.lists };

    case 'listPut': {
      const { [LIST_PREFIX + action.list.id]: _gone, ...tombstones } = state.tombstones;
      return { ...state, tombstones, lists: { ...state.lists, [action.list.id]: action.list } };
    }

    case 'listDelete': {
      const { [action.id]: _removed, ...lists } = state.lists;
      return { ...state, lists, tombstones: { ...state.tombstones, [LIST_PREFIX + action.id]: new Date().toISOString() } };
    }

    case 'listsImported': {
      // Listas traídas de otra app: si ya existe una con el mismo nombre, se le suman los títulos.
      const lists = { ...state.lists };
      const now = new Date().toISOString();
      for (const inc of action.lists) {
        const same = Object.values(lists).find((l) => l.name.toLowerCase() === inc.name.toLowerCase());
        if (!same) {
          lists[inc.id] = inc;
          continue;
        }
        const have = new Set(same.entries.map((e) => e.key));
        lists[same.id] = {
          ...same,
          entries: [...same.entries, ...inc.entries.filter((e) => !have.has(e.key))],
          updatedAt: now,
        };
      }
      return { ...state, lists };
    }

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
      const lists = { ...state.lists };
      for (const row of action.rows) {
        if (row.key.startsWith(LIST_PREFIX)) {
          const id = row.key.slice(LIST_PREFIX.length);
          const local = lists[id];
          const remote = row.data as unknown as CustomList | null;
          const localTime = local?.updatedAt ?? tombstones[row.key] ?? '';
          if (row.deleted) {
            if (local && localTime <= row.client_updated_at) {
              delete lists[id];
              tombstones[row.key] = row.client_updated_at;
              changed = true;
            }
          } else if (remote && localTime < remote.updatedAt) {
            lists[id] = remote;
            delete tombstones[row.key];
            changed = true;
          }
          continue;
        }
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
      return changed ? { ...state, items, tombstones, lists } : state;
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

    case 'mergeImported': {
      // Historial traído de otra app: se suma a lo que ya hay sin perder nada.
      const items = { ...state.items };
      const tombstones = { ...state.tombstones };
      const now = new Date().toISOString();
      for (const inc of action.items) {
        const cur = items[inc.key];
        delete tombstones[inc.key];
        if (!cur) {
          items[inc.key] = { ...inc, status: autoStatus(inc) };
          continue;
        }
        const watchedEpisodes: Record<string, string> = { ...inc.watchedEpisodes };
        for (const [k, at] of Object.entries(cur.watchedEpisodes)) {
          if (!watchedEpisodes[k] || at < watchedEpisodes[k]) watchedEpisodes[k] = at;
        }
        const merged: LibraryItem = {
          ...cur,
          // Lo que ya decidiste en Sollar manda; lo importado llena lo que falta.
          status: cur.status === 'planned' ? inc.status : cur.status,
          rating: cur.rating ?? inc.rating,
          favorite: cur.favorite || inc.favorite,
          watchedAt: cur.watchedAt ?? inc.watchedAt,
          addedAt: inc.addedAt < cur.addedAt ? inc.addedAt : cur.addedAt,
          watchedEpisodes: watchedEpisodes as LibraryItem['watchedEpisodes'],
          updatedAt: now,
        };
        items[inc.key] = { ...merged, status: autoStatus(merged) };
      }
      return { ...state, items, tombstones };
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
  raw: {
    items: Record<string, LibraryItem>;
    tombstones: Record<string, string>;
    lists: Record<string, CustomList>;
  };
  applyRemote: (rows: RemoteRow[]) => void;
  /** Listas propias, en el orden en que se crearon. */
  lists: CustomList[];
  createList: (name: string, description?: string, entries?: ListEntry[]) => string;
  updateList: (id: string, patch: Partial<Pick<CustomList, 'name' | 'description'>>) => void;
  deleteList: (id: string) => void;
  addToList: (id: string, entry: ListEntry) => void;
  removeFromList: (id: string, key: string) => void;
  /** Mueve un título dentro de la lista (-1 sube, 1 baja). */
  moveInList: (id: string, key: string, delta: number) => void;
  importLists: (lists: CustomList[]) => void;
  toggleFavorite: (key: string) => void;
  /** Suma títulos importados de otra app (une episodios vistos, no pisa tus decisiones). */
  mergeImported: (items: LibraryItem[]) => void;
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
  const [state, dispatch] = useReducer(reducer, { ready: false, items: {}, tombstones: {}, lists: {} });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar al iniciar.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY).then((raw) => raw ?? AsyncStorage.getItem(OLD_STORAGE_KEY)),
      AsyncStorage.getItem(TOMBSTONES_KEY),
      AsyncStorage.getItem(LISTS_KEY),
    ])
      .then(([raw, dead, rawLists]) => {
        const items = raw ? (JSON.parse(raw) as Record<string, LibraryItem>) : {};
        const tombstones = dead ? (JSON.parse(dead) as Record<string, string>) : {};
        const lists = rawLists ? (JSON.parse(rawLists) as Record<string, CustomList>) : {};
        dispatch({ type: 'hydrate', items, tombstones, lists });
      })
      .catch(() => dispatch({ type: 'hydrate', items: {}, tombstones: {}, lists: {} }));
  }, []);

  // Guardar con un pequeño retraso para agrupar cambios seguidos (marcar varios episodios).
  useEffect(() => {
    if (!state.ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)).catch(() => {});
      AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(state.tombstones)).catch(() => {});
      AsyncStorage.setItem(LISTS_KEY, JSON.stringify(state.lists)).catch(() => {});
    }, 300);
  }, [state]);

  const get = useCallback((key: string) => state.items[key], [state.items]);

  const api = useMemo<LibraryApi>(
    () => ({
      ready: state.ready,
      raw: { items: state.items, tombstones: state.tombstones, lists: state.lists },
      lists: Object.values(state.lists).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      createList: (name, description = '', entries = []) => {
        const now = new Date().toISOString();
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        dispatch({ type: 'listPut', list: { id, name: name.trim(), description, entries, createdAt: now, updatedAt: now } });
        return id;
      },
      updateList: (id, patch) => {
        const l = state.lists[id];
        if (l) dispatch({ type: 'listPut', list: { ...l, ...patch, updatedAt: new Date().toISOString() } });
      },
      deleteList: (id) => dispatch({ type: 'listDelete', id }),
      addToList: (id, entry) => {
        const l = state.lists[id];
        if (!l || l.entries.some((e) => e.key === entry.key)) return;
        dispatch({ type: 'listPut', list: { ...l, entries: [...l.entries, entry], updatedAt: new Date().toISOString() } });
      },
      removeFromList: (id, key) => {
        const l = state.lists[id];
        if (!l) return;
        dispatch({
          type: 'listPut',
          list: { ...l, entries: l.entries.filter((e) => e.key !== key), updatedAt: new Date().toISOString() },
        });
      },
      moveInList: (id, key, delta) => {
        const l = state.lists[id];
        if (!l) return;
        const from = l.entries.findIndex((e) => e.key === key);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= l.entries.length) return;
        const entries = [...l.entries];
        const [moved] = entries.splice(from, 1);
        entries.splice(to, 0, moved);
        dispatch({ type: 'listPut', list: { ...l, entries, updatedAt: new Date().toISOString() } });
      },
      importLists: (lists) => dispatch({ type: 'listsImported', lists }),
      toggleFavorite: (key) => {
        const item = state.items[key];
        if (item) dispatch({ type: 'patch', key, patch: { favorite: !item.favorite } });
      },
      applyRemote: (rows) => dispatch({ type: 'remote', rows }),
      mergeImported: (items) => dispatch({ type: 'mergeImported', items }),
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
