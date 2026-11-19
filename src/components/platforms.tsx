/** Selector de "Mis plataformas" y logo pequeño de una plataforma. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { findWordmark, getNetworkLogo, getProviderDirectory, type Wordmark } from '@/lib/tmdb';
import type { ProviderInfo } from '@/lib/types';
import { useSettings } from '@/store/settings';

import { card } from './glass';
import { Icon } from './icons';
import { Loading, T } from './ui';
import { Touchable } from './touch';

let directoryCache: ProviderInfo[] | null = null;
let loading: Promise<ProviderInfo[]> | null = null;
const DIR_KEY = 'sollar.providers.v1';

/** Un solo tamaño para todos los logos: así se descargan una vez y aparecen al instante. */
export function logoUri(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w185${path}` : null;
}

function loadDirectory(): Promise<ProviderInfo[]> {
  if (loading) return loading;
  loading = (async () => {
    // Primero la copia guardada (instantánea); luego la de TMDB, que la actualiza.
    const saved = await AsyncStorage.getItem(DIR_KEY).catch(() => null);
    if (saved && !directoryCache) {
      try {
        directoryCache = JSON.parse(saved) as ProviderInfo[];
      } catch {
        // Copia dañada: se ignora.
      }
    }
    const fresh = getProviderDirectory()
      .then((l) => {
        directoryCache = l;
        AsyncStorage.setItem(DIR_KEY, JSON.stringify(l)).catch(() => {});
        Image.prefetch(l.map((p) => logoUri(p.logoPath)).filter((u): u is string => !!u), 'memory-disk').catch(() => {});
        return l;
      });
    if (directoryCache) {
      Image.prefetch(directoryCache.map((p) => logoUri(p.logoPath)).filter((u): u is string => !!u), 'memory-disk').catch(() => {});
      fresh.catch(() => {});
      return directoryCache;
    }
    return fresh;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export function useProviderDirectory() {
  const [list, setList] = useState<ProviderInfo[] | null>(directoryCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (directoryCache) return;
    loadDirectory()
      .then(setList)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { list, error };
}

/** Logo de la plataforma; si no hay imagen (modo demostración), sus iniciales. */
export function ProviderLogo({ name, logoPath, size = 28 }: { name: string; logoPath: string | null; size?: number }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const uri = logoUri(logoPath || null);
  const box = { width: size, height: size, borderRadius: size / 4 };
  if (uri) return <Image source={{ uri }} style={box} cachePolicy="memory-disk" transition={0} priority="high" />;
  const initials = name
    .replace(/\+/g, ' Plus')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <View style={[box, styles.initials]}>
      <T style={{ fontSize: size * 0.4, fontWeight: '800', color: C.text }}>{initials}</T>
    </View>
  );
}

/** Cuadrícula para marcar las plataformas que pagas. */
export function PlatformPicker({ limit = 24 }: { limit?: number }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { list, error } = useProviderDirectory();
  const { myProviders, toggleProvider } = useSettings();
  const [showAll, setShowAll] = useState(false);

  if (error) return <T variant="small" style={{ color: C.danger }}>{error}</T>;
  if (!list) return <Loading />;

  // Las elegidas siempre visibles, aunque no estén entre las más populares.
  const top = showAll ? list : list.slice(0, limit);
  const shown = [...top, ...list.filter((p) => myProviders.includes(p.id) && !top.includes(p))];

  return (
    <View style={{ gap: Space.md }}>
      <View style={styles.grid}>
        {shown.map((p) => {
          const on = myProviders.includes(p.id);
          return (
            <Touchable
              key={p.id}
              onPress={() => toggleProvider(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.75 }]}>
              <ProviderLogo name={p.name} logoPath={p.logoPath} />
              <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: on ? '700' : '500' }}>
                {p.name}
              </T>
              <Icon name={on ? 'check' : 'plus'} size={18} color={on ? C.accent : C.textFaint} strokeWidth={2.4} />
            </Touchable>
          );
        })}
      </View>
      {list.length > limit ? (
        <Touchable onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
          <T variant="small" style={{ color: C.accentInk }}>
            {showAll ? 'Ver menos' : `Ver las ${list.length} plataformas`}
          </T>
        </Touchable>
      ) : null}
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  tile: {
    ...card(C),
    flexGrow: 1,
    flexBasis: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.sm,
    paddingRight: Space.md,
    borderRadius: Radius.md,
  },
  tileOn: { borderColor: C.accentLine, backgroundColor: C.accentSoft },
  initials: {
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// --- Logos con el nombre (como JustWatch) ---

/**
 * Las grandes, con su red en TMDB (el logo más fiel). Las demás se buscan solas por su nombre
 * entre las compañías de TMDB; si no hay logo, se usa el ícono oficial de la app.
 */
const WORDMARK_NETWORK: Record<number, number> = {
  8: 213, // Netflix
  1796: 213,
  337: 2739, // Disney+
  119: 1024, // Prime Video
  9: 1024,
  1899: 3186, // Max
  384: 3186,
  350: 2552, // Apple TV+
  2: 2552,
  531: 4330, // Paramount+
  283: 1112, // Crunchyroll
  15: 453, // Hulu
  386: 3353, // Peacock
};

const WM_KEY = 'sollar.wordmarks.v2';
let wordmarks: Record<string, Wordmark | null> | null = null;
let wmLoad: Promise<void> | null = null;
const pending = new Map<string, Promise<Wordmark | null>>();

function loadWordmarks() {
  if (wmLoad) return wmLoad;
  wmLoad = AsyncStorage.getItem(WM_KEY)
    .then((raw) => {
      wordmarks = raw ? (JSON.parse(raw) as Record<string, Wordmark | null>) : {};
    })
    .catch(() => {
      wordmarks = {};
    });
  return wmLoad;
}

function lookup(id: number, name: string): Promise<Wordmark | null> {
  const k = String(id);
  const running = pending.get(k);
  if (running) return running;
  const net = WORDMARK_NETWORK[id];
  const job = (net ? getNetworkLogo(net) : findWordmark(name))
    .catch(() => null)
    .then((w) => {
      wordmarks = { ...(wordmarks ?? {}), [k]: w };
      AsyncStorage.setItem(WM_KEY, JSON.stringify(wordmarks)).catch(() => {});
      return w;
    });
  pending.set(k, job);
  return job;
}

function useWordmark(id: number, name: string) {
  const k = String(id);
  const [w, setW] = useState<Wordmark | null | undefined>(wordmarks ? wordmarks[k] : undefined);
  useEffect(() => {
    let off = false;
    loadWordmarks().then(async () => {
      if (off) return;
      if (wordmarks && k in wordmarks) return setW(wordmarks[k]);
      const got = await lookup(id, name);
      if (!off) setW(got);
    });
    return () => {
      off = true;
    };
  }, [id, k, name]);
  return w;
}

/** Luminosidad de un logo no se conoce de antemano: en modo oscuro los muy oscuros pasan a blanco. */
const DARK_LOGO = new Set([2552, 3186, 1024]);

/**
 * Logo con el nombre de la plataforma, en sus colores. Todos se ven del mismo tamaño: el alto se
 * ajusta según qué tan ancho es cada logo (uno cuadrado sale más alto, uno alargado más bajo).
 */
export function ProviderWordmark({ id, name, logoPath, box = 80 }: { id: number; name: string; logoPath: string | null; box?: number }) {
  const C = useColors();
  const w = useWordmark(id, name);
  if (w === undefined) return <View style={{ width: box, height: box * 0.42 }} />;
  if (!w) return <ProviderLogo name={name} logoPath={logoPath} size={Math.round(box * 0.52)} />;
  // Área visual pareja: ancho y alto según la proporción, dentro de la caja.
  const aspect = Math.max(1, Math.min(w.aspect, 6));
  const height = Math.min(box * 0.5, (box * 0.62) / Math.sqrt(aspect));
  const width = Math.min(box, height * aspect);
  const net = WORDMARK_NETWORK[id];
  const whiten = C.mode === 'dark' && net != null && DARK_LOGO.has(net);
  return (
    <View style={whiten ? ({ filter: 'brightness(0) invert(1)' } as object) : undefined}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w300${w.path}` }}
        style={{ width, height }}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
        tintColor={whiten ? '#FFFFFF' : undefined}
        accessibilityLabel={name}
      />
    </View>
  );
}
