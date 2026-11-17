/**
 * Preferencias del usuario: por ahora, las plataformas que paga.
 * Se guardan en el dispositivo y, con cuenta, se sincronizan (store/sync.tsx).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'sollar.settings.v1';
const OLD_KEY = 'butaca.settings.v1';

type Settings = { myProviders: number[]; updatedAt: string };

type SettingsApi = Settings & {
  ready: boolean;
  updatedAt: string;
  toggleProvider: (id: number) => void;
  setProviders: (ids: number[]) => void;
  /** Aplica las plataformas que llegan de otro dispositivo, si son más recientes. */
  applyRemote: (ids: number[], at: string) => void;
};

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [myProviders, setMyRaw] = useState<number[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const setMy = (fn: number[] | ((cur: number[]) => number[])) => {
    setMyRaw(fn);
    setUpdatedAt(new Date().toISOString());
  };

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw ?? AsyncStorage.getItem(OLD_KEY))
      .then((raw) => {
        const s = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
        if (Array.isArray(s.myProviders)) setMyRaw(s.myProviders);
        if (s.updatedAt) setUpdatedAt(s.updatedAt);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ myProviders, updatedAt })).catch(() => {});
  }, [ready, myProviders, updatedAt]);

  const api = useMemo<SettingsApi>(
    () => ({
      ready,
      myProviders,
      updatedAt,
      toggleProvider: (id) => setMy((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
      setProviders: (ids) => setMy(ids),
      applyRemote: (ids, at) => {
        if (at <= updatedAt) return;
        setMyRaw(ids);
        setUpdatedAt(at);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, myProviders, updatedAt],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  return ctx;
}
