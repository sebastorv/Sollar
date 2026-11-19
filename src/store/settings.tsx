/**
 * Preferencias del usuario: por ahora, las plataformas que paga.
 * Se guardan en el dispositivo y, con cuenta, se sincronizan (store/sync.tsx).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setRegion } from '@/lib/tmdb';

const KEY = 'sollar.settings.v1';
const OLD_KEY = 'butaca.settings.v1';

/** Lo que se ve en tu perfil: nombre, foto (pequeña, en JPEG) y una frase. */
export type MyProfile = {
  name: string;
  avatar: string | null;
  bio: string;
  /** País para "Dónde ver" (código de dos letras). */
  region?: string;
  /** Fondo de la app: imagen de fondo (TMDB) de un título; null para ninguno; sin valor, tu favorita. */
  wallpaper?: string | null;
};
const EMPTY_PROFILE: MyProfile = { name: '', avatar: null, bio: '' };

type Settings = { myProviders: number[]; profile: MyProfile; updatedAt: string };

type SettingsApi = Settings & {
  ready: boolean;
  updatedAt: string;
  toggleProvider: (id: number) => void;
  setProviders: (ids: number[]) => void;
  setProfile: (patch: Partial<MyProfile>) => void;
  /** Aplica lo que llega de otro dispositivo, si es más reciente. */
  applyRemote: (data: { myProviders?: number[]; profile?: MyProfile }, at: string) => void;
};

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [myProviders, setMyRaw] = useState<number[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [profile, setProfileRaw] = useState<MyProfile>(EMPTY_PROFILE);
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
        if (s.profile) setProfileRaw({ ...EMPTY_PROFILE, ...s.profile });
        if (s.updatedAt) setUpdatedAt(s.updatedAt);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // El país elegido rige para todo lo que se pide a TMDB.
  useEffect(() => {
    setRegion(profile.region ?? 'CO');
  }, [profile.region]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ myProviders, profile, updatedAt })).catch(() => {});
  }, [ready, myProviders, profile, updatedAt]);

  const api = useMemo<SettingsApi>(
    () => ({
      ready,
      myProviders,
      profile,
      updatedAt,
      toggleProvider: (id) => setMy((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
      setProviders: (ids) => setMy(ids),
      setProfile: (patch) => {
        setProfileRaw((cur) => ({ ...cur, ...patch }));
        setUpdatedAt(new Date().toISOString());
      },
      applyRemote: (data, at) => {
        if (at <= updatedAt) return;
        if (Array.isArray(data.myProviders)) setMyRaw(data.myProviders);
        if (data.profile) setProfileRaw({ ...EMPTY_PROFILE, ...data.profile });
        setUpdatedAt(at);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, myProviders, profile, updatedAt],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  return ctx;
}
