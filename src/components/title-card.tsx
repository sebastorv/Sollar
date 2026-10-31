import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';
import type { MediaType } from '@/lib/types';

import { Poster, T } from './ui';

/** Tarjeta vertical (carátula + título) que abre la ficha del título. */
export function TitleCard({
  id,
  mediaType,
  title,
  posterPath,
  subtitle,
  badge,
  highlight,
  width = 120,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  subtitle?: string | null;
  badge?: string | null;
  /** Texto destacado bajo el título, por ejemplo "En Netflix". */
  highlight?: string | null;
  width?: number;
}) {
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: mediaType, id: String(id) } }} asChild>
      <Pressable style={({ pressed }) => [{ width, gap: Space.xs }, pressed && { opacity: 0.8 }]}>
        <View>
          <Poster path={posterPath} title={title} width={width} />
          {badge ? (
            <View style={styles.badge}>
              <T variant="caption" style={{ color: C.accent, fontWeight: '700' }}>
                {badge}
              </T>
            </View>
          ) : null}
        </View>
        <T variant="small" numberOfLines={2} style={{ fontWeight: '600' }}>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" muted numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        {highlight ? (
          <T variant="caption" numberOfLines={1} style={{ color: C.accent, fontWeight: '700' }}>
            {highlight}
          </T>
        ) : null}
      </Pressable>
    </Link>
  );
}

/** Rejilla adaptable: tantas columnas como quepan. */
export function Grid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: Space.xs + 2,
    left: Space.xs + 2,
    backgroundColor: 'rgba(18, 13, 23, 0.78)',
    borderWidth: 1,
    borderColor: C.accentLine,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.lg },
});
