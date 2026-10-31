/**
 * Preferencias del usuario: por ahora, las plataformas que paga.
 * Se guardan en el dispositivo, igual que la biblioteca.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'butaca.settings.v1';

type Settings = { myProviders: number[] };

type SettingsApi = Settings & {
  ready: boolean;
  toggleProvider: (id: number) => void;
  setProviders: (ids: number[]) => void;
};

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [myProviders, setMy] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const s = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
        if (Array.isArray(s.myProviders)) setMy(s.myProviders);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ myProviders })).catch(() => {});
  }, [ready, myProviders]);

  const api = useMemo<SettingsApi>(
    () => ({
      ready,
      myProviders,
      toggleProvider: (id) => setMy((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
      setProviders: setMy,
    }),
    [ready, myProviders],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  return ctx;
}
