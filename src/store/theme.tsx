/**
 * Tema de la app: modo (claro, oscuro o el del teléfono) y color de la marca.
 * Se guarda en el dispositivo. Por defecto: modo claro y color Brasa.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { makeColors, type AccentName, type Colors } from '@/constants/theme';

export type ModeSetting = 'light' | 'dark' | 'system';

type ThemeState = {
  mode: ModeSetting;
  accent: AccentName;
  setMode: (m: ModeSetting) => void;
  setAccent: (a: AccentName) => void;
  colors: Colors;
};

const KEY = 'sollar.theme.v1';
const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ModeSetting>('light');
  const [accent, setAccent] = useState<AccentName>('brasa');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<{ mode: ModeSetting; accent: AccentName }>;
        if (saved.mode) setMode(saved.mode);
        if (saved.accent) setAccent(saved.accent);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify({ mode, accent })).catch(() => {});
  }, [loaded, mode, accent]);

  const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const colors = useMemo(() => makeColors(resolved, accent), [resolved, accent]);
  const value = useMemo(() => ({ mode, accent, setMode, setAccent, colors }), [mode, accent, colors]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemeSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useThemeSettings debe usarse dentro de ThemeProvider');
  return v;
}

/** Colores del tema actual. */
export function useColors(): Colors {
  return useThemeSettings().colors;
}

/** Estilos que dependen del tema: se recalculan solo cuando cambia el tema. */
export function useStyles<T>(factory: (c: Colors) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [c, factory]);
}

/**
 * Fuerza el modo oscuro en una parte de la pantalla: para el texto que va sobre una imagen de
 * fondo, que siempre necesita letras claras para leerse bien.
 */
export function DarkScope({ children }: { children: ReactNode }) {
  const parent = useThemeSettings();
  const colors = useMemo(() => makeColors('dark', parent.accent), [parent.accent]);
  const value = useMemo(() => ({ ...parent, colors }), [parent, colors]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
