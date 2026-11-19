/** Selector de "Mis plataformas" y logo pequeño de una plataforma. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { getNetworkLogo, getProviderDirectory } from '@/lib/tmdb';
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
 * Cada plataforma con su red en TMDB, que trae el logo con el nombre (no el ícono cuadrado de la
 * app). Las que no están aquí se muestran con su nombre escrito.
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
/** Logos que se ven bien en su color original; los demás se muestran en un solo tono. */
const KEEP_COLOR = new Set([213, 1112, 453]);

const WM_KEY = 'sollar.wordmarks.v1';
let wordmarks: Record<number, string | null> | null = null;
let wmLoad: Promise<void> | null = null;

function loadWordmarks() {
  if (wmLoad) return wmLoad;
  wmLoad = AsyncStorage.getItem(WM_KEY)
    .then((raw) => {
      wordmarks = raw ? (JSON.parse(raw) as Record<number, string | null>) : {};
    })
    .catch(() => {
      wordmarks = {};
    });
  return wmLoad;
}

function useWordmark(providerId: number): { path: string | null; network: number | null; ready: boolean } {
  const network = WORDMARK_NETWORK[providerId] ?? null;
  const [path, setPath] = useState<string | null>(network && wordmarks ? wordmarks[network] ?? null : null);
  const [ready, setReady] = useState(!network || (wordmarks != null && network in wordmarks));
  useEffect(() => {
    if (!network) return;
    let off = false;
    loadWordmarks().then(async () => {
      if (off) return;
      if (wordmarks && network in wordmarks) {
        setPath(wordmarks[network]);
        setReady(true);
        return;
      }
      const p = await getNetworkLogo(network).catch(() => null);
      if (off) return;
      wordmarks = { ...(wordmarks ?? {}), [network]: p };
      AsyncStorage.setItem(WM_KEY, JSON.stringify(wordmarks)).catch(() => {});
      setPath(p);
      setReady(true);
    });
    return () => {
      off = true;
    };
  }, [network]);
  return { path, network, ready };
}

/** Logo con el nombre de la plataforma, en blanco (modo oscuro) o negro (claro). */
export function ProviderWordmark({ id, name, width = 84, height = 34 }: { id: number; name: string; width?: number; height?: number }) {
  const C = useColors();
  const { path, network, ready } = useWordmark(id);
  const keep = network != null && KEEP_COLOR.has(network);
  const mono = C.mode === 'dark' ? '#FFFFFF' : '#16141B';
  if (!ready) return <View style={{ width, height }} />;
  if (!path) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <T numberOfLines={2} style={{ fontSize: 14, lineHeight: 16, fontWeight: '700', textAlign: 'center', color: C.text }}>
          {name}
        </T>
      </View>
    );
  }
  return (
    <View
      style={{
        width,
        height,
        // En la web el tono único se logra con un filtro; en iPhone y Android, con tintColor.
        ...(keep ? {} : ({ filter: C.mode === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' } as object)),
      }}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w300${path}` }}
        style={{ width, height }}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
        tintColor={keep ? undefined : mono}
        accessibilityLabel={name}
      />
    </View>
  );
}
