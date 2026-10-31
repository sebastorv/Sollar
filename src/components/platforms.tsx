/** Selector de "Mis plataformas" y logo pequeño de una plataforma. */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';
import { getProviderDirectory, imageUrl } from '@/lib/tmdb';
import type { ProviderInfo } from '@/lib/types';
import { useSettings } from '@/store/settings';

import { Loading, T } from './ui';

let directoryCache: ProviderInfo[] | null = null;

export function useProviderDirectory() {
  const [list, setList] = useState<ProviderInfo[] | null>(directoryCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (directoryCache) return;
    getProviderDirectory()
      .then((l) => {
        directoryCache = l;
        setList(l);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  return { list, error };
}

/** Logo de la plataforma; si no hay imagen (modo demostración), sus iniciales. */
export function ProviderLogo({ name, logoPath, size = 28 }: { name: string; logoPath: string | null; size?: number }) {
  const uri = imageUrl(logoPath || null, 'w92');
  const box = { width: size, height: size, borderRadius: size / 4 };
  if (uri) return <Image source={{ uri }} style={box} />;
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
            <Pressable
              key={p.id}
              onPress={() => toggleProvider(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.75 }]}>
              <ProviderLogo name={p.name} logoPath={p.logoPath} />
              <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: on ? '700' : '500' }}>
                {p.name}
              </T>
              <T style={{ color: on ? C.accent : C.textFaint, fontWeight: '800' }}>{on ? '✓' : '+'}</T>
            </Pressable>
          );
        })}
      </View>
      {list.length > limit ? (
        <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
          <T variant="small" style={{ color: C.accent }}>
            {showAll ? 'Ver menos' : `Ver las ${list.length} plataformas`}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.sm,
    paddingRight: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  tileOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  initials: { backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
});
