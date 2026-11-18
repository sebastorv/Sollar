/**
 * Sincronización automática entre dispositivos.
 *
 * Con sesión iniciada:
 * - Sube los cambios locales poco después de hacerlos.
 * - Baja los cambios de otros dispositivos al abrir la app, al volver a ella, cada minuto
 *   y al instante cuando el servidor avisa (tiempo real).
 * - La primera vez en un dispositivo, sube todo lo que ya había en él y baja lo de la cuenta.
 *
 * Recuerda qué versión de cada título ya está en el servidor para subir solo lo que cambió.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { onRemoteChange, pullRows, pullSettings, pushRows, pushSettings, type PushRow } from '@/lib/cloud';

import { useAuth } from './auth';
import { LIST_PREFIX, useLibrary } from './library';
import { useSettings } from './settings';

const META_KEY = 'sollar.sync.v1';

type Meta = {
  userId: string;
  /** Hasta qué momento del servidor ya se bajaron cambios. */
  lastPull: string | null;
  /** Versión de cada título que ya está en el servidor (fecha de cambio o "x" + fecha de borrado). */
  synced: Record<string, string>;
  settingsSynced: string;
};

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline';

type SyncApi = { status: SyncStatus; lastSync: string | null; error: string | null; syncNow: () => void };

const Ctx = createContext<SyncApi>({ status: 'off', lastSync: null, error: null, syncNow: () => {} });

export function SyncProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const library = useLibrary();
  const settings = useSettings();
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Las funciones de sincronización leen siempre el estado más reciente desde estas referencias.
  const libRef = useRef(library);
  libRef.current = library;
  const setRef = useRef(settings);
  setRef.current = settings;
  const meta = useRef<Meta | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const saveMeta = () => {
    if (meta.current) AsyncStorage.setItem(META_KEY, JSON.stringify(meta.current)).catch(() => {});
  };

  const run = useCallback(async () => {
    if (!userId || !libRef.current.ready || !setRef.current.ready) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      if (!meta.current || meta.current.userId !== userId) {
        const raw = await AsyncStorage.getItem(META_KEY);
        const saved = raw ? (JSON.parse(raw) as Meta) : null;
        // Otra cuenta en este dispositivo: se empieza de cero (y se sube lo que haya).
        meta.current =
          saved && saved.userId === userId ? saved : { userId, lastPull: null, synced: {}, settingsSynced: '' };
      }
      const m = meta.current;

      // 1. Bajar lo nuevo del servidor y aplicarlo.
      const rows = await pullRows(m.lastPull);
      if (rows.length) {
        libRef.current.applyRemote(rows);
        for (const r of rows) {
          m.synced[r.key] = r.deleted
            ? `x${r.client_updated_at}`
            : ((r.data as { updatedAt?: string } | null)?.updatedAt ?? r.client_updated_at);
          if (!m.lastPull || r.updated_at > m.lastPull) m.lastPull = r.updated_at;
        }
      } else if (!m.lastPull) {
        m.lastPull = new Date(0).toISOString();
      }
      const remoteSettings = await pullSettings();
      if (remoteSettings?.data.myProviders && remoteSettings.client_updated_at > setRef.current.updatedAt) {
        setRef.current.applyRemote(remoteSettings.data.myProviders, remoteSettings.client_updated_at);
        m.settingsSynced = remoteSettings.client_updated_at;
      }

      // 2. Subir lo que cambió aquí. Se espera un instante para que el estado local
      //    incluya lo que se acaba de bajar.
      await new Promise((r) => setTimeout(r, 0));
      const { items, tombstones, lists } = libRef.current.raw;
      const push: PushRow[] = [];
      for (const it of Object.values(items)) {
        if (m.synced[it.key] !== it.updatedAt) {
          const { availability: _a, ...data } = it;
          push.push({ key: it.key, data: data as typeof it, deleted: false, client_updated_at: it.updatedAt });
        }
      }
      for (const l of Object.values(lists)) {
        const key = LIST_PREFIX + l.id;
        if (m.synced[key] !== l.updatedAt) {
          push.push({ key, data: l as unknown as PushRow['data'], deleted: false, client_updated_at: l.updatedAt });
        }
      }
      for (const [key, at] of Object.entries(tombstones)) {
        const alive = key.startsWith(LIST_PREFIX) ? lists[key.slice(LIST_PREFIX.length)] : items[key];
        if (m.synced[key] !== `x${at}` && !alive) {
          push.push({ key, data: null, deleted: true, client_updated_at: at });
        }
      }
      await pushRows(userId, push);
      for (const p of push) m.synced[p.key] = p.deleted ? `x${p.client_updated_at}` : p.client_updated_at;

      const s = setRef.current;
      if (s.updatedAt && s.updatedAt !== m.settingsSynced) {
        await pushSettings(userId, { myProviders: s.myProviders }, s.updatedAt);
        m.settingsSynced = s.updatedAt;
      }

      saveMeta();
      setLastSync(new Date().toISOString());
      setError(null);
      setStatus('ok');
    } catch (e) {
      setError((e as Error).message);
      setStatus('offline');
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(run, 300);
      }
    }
  }, [userId]);

  // Al iniciar sesión (o cuando ya cargó todo).
  useEffect(() => {
    if (!userId) {
      setStatus('off');
      return;
    }
    if (library.ready && settings.ready) run();
  }, [userId, library.ready, settings.ready, run]);

  // Cambios locales: se suben poco después (agrupa varios toques seguidos).
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userId || !library.ready) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(run, 1500);
  }, [library.raw, settings.updatedAt, userId, library.ready, run]);

  // Cambios de otros dispositivos, al volver a la app y cada minuto.
  useEffect(() => {
    if (!userId) return;
    const stopRealtime = onRemoteChange(userId, () => run());
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    const onVisible = () => document.visibilityState === 'visible' && run();
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(run, 60_000);
    return () => {
      stopRealtime();
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [userId, run]);

  const api = useMemo(() => ({ status, lastSync, error, syncNow: () => run() }), [status, lastSync, error, run]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSync(): SyncApi {
  return useContext(Ctx);
}
