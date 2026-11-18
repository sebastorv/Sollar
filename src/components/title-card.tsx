import { Link } from 'expo-router';
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import type { MediaType } from '@/lib/types';

import { Poster, T } from './ui';
import { Touchable } from './touch';

/**
 * Tarjeta vertical (carátula + título) que abre la ficha del título.
 * El texto ocupa siempre el mismo alto (título de hasta dos líneas, subtítulo y destacado de una),
 * así las tarjetas quedan parejas en filas y en estantes aunque los títulos tengan largos distintos.
 */
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
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: mediaType, id: String(id) } }} asChild>
      <Touchable style={{ width, gap: Space.xs }} accessibilityLabel={title}>
        <View>
          <Poster path={posterPath} title={title} width={width} />
          {badge ? (
            <View style={styles.badge}>
              <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
                {badge}
              </T>
            </View>
          ) : null}
        </View>
        <View style={styles.text}>
          <T variant="small" numberOfLines={2} style={styles.title}>
            {title}
          </T>
          <T variant="caption" muted numberOfLines={1} style={styles.line}>
            {subtitle ?? ' '}
          </T>
          <T variant="caption" numberOfLines={1} style={[styles.line, { color: C.accentInk, fontWeight: '700' }]}>
            {highlight ?? ' '}
          </T>
        </View>
      </Touchable>
    </Link>
  );
}

/**
 * Rejilla pareja: calcula cuántas columnas caben y reparte el ancho exacto entre ellas, para que
 * no quede un hueco irregular a la derecha. Ajusta el ancho de cada TitleCard.
 */
export function Grid({ children, minWidth = 108 }: { children: ReactNode; minWidth?: number }) {
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const gap = Space.md;
  const columns = Math.max(2, Math.floor((width + gap) / (minWidth + gap)));
  const cardWidth = width ? Math.floor((width - gap * (columns - 1)) / columns) : minWidth;
  return (
    <View style={[styles.grid, { columnGap: gap }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width
        ? Children.map(children, (child) =>
            isValidElement(child) ? cloneElement(child as ReactElement<{ width?: number }>, { width: cardWidth }) : child,
          )
        : null}
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  badge: {
    position: 'absolute',
    top: Space.xs + 2,
    left: Space.xs + 2,
    backgroundColor: C.glassStrong,
    borderWidth: 1,
    borderColor: C.accentLine,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Space.lg },
  text: { gap: 1 },
  /** Dos líneas de título reservadas siempre. */
  title: { fontWeight: '600', minHeight: 40, lineHeight: 20 },
  line: { minHeight: 16 },
});
