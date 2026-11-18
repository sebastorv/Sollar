import { Link } from 'expo-router';
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { STATUS_LABEL, type MediaType, type WatchStatus } from '@/lib/types';

import { Icon, type IconName } from './icons';
import { Poster, T } from './ui';
import { ProviderLogo, useProviderDirectory } from './platforms';
import { itemKey } from '@/lib/library-item';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
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
  onCheck,
  checkLabel,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  subtitle?: string | null;
  /** Estado en tu lista: se muestra como un ícono pequeño sobre la carátula. */
  badge?: WatchStatus | null;
  /** Texto destacado bajo el título, por ejemplo "En Netflix". */
  highlight?: string | null;
  width?: number;
  /** Botón ✓ junto al título (marcar como visto, empezar la serie). */
  onCheck?: () => void;
  checkLabel?: string;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: mediaType, id: String(id) } }} asChild>
      <Touchable style={{ width, gap: Space.xs }} accessibilityLabel={title}>
        <View>
          <Poster path={posterPath} title={title} width={width} />
          <PosterMarks mediaType={mediaType} id={id} badge={badge} width={width} />
        </View>
        <View style={styles.textRow}>
          <View style={styles.text}>
            <T numberOfLines={1} style={styles.title}>
              {title}
            </T>
            <T variant="caption" muted numberOfLines={1} style={styles.line}>
              {subtitle ?? ' '}
            </T>
            {highlight !== undefined ? (
              <T variant="caption" numberOfLines={1} style={[styles.line, { color: C.accentInk, fontWeight: '700' }]}>
                {highlight ?? ' '}
              </T>
            ) : null}
          </View>
          {onCheck ? (
            <Touchable
              onPress={onCheck}
              haptic="success"
              pressScale={0.8}
              hitSlop={8}
              accessibilityLabel={checkLabel ?? `Marcar ${title} como visto`}
              style={styles.check}>
              <Icon name="check" size={20} color={C.accentInk} strokeWidth={2.4} />
            </Touchable>
          ) : null}
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

const STATUS_ICON: Record<WatchStatus, IconName> = {
  watching: 'playSolid',
  completed: 'check',
  planned: 'bookmark',
  paused: 'pause',
  dropped: 'close',
};

/** Burbuja de vidrio con el ícono del estado: dice "viendo", "vista"… sin tapar la carátula. */
export function StatusBadge({ status, size = 26 }: { status: WatchStatus; size?: number }) {
  const C = useColors();
  const done = status === 'completed';
  return (
    <View
      accessibilityLabel={STATUS_LABEL[status]}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? C.accent : 'rgba(14,13,18,0.62)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
      }}>
      <Icon name={STATUS_ICON[status]} size={size * 0.55} color="#fff" filled={status === 'planned'} strokeWidth={2.6} />
    </View>
  );
}

/**
 * Marcas sobre la carátula, pequeñas y con vidrio para no taparla:
 * arriba a la izquierda, si es serie o película; arriba a la derecha, tu estado (viendo, vista,
 * por ver…); abajo a la izquierda, el logo del servicio donde está (primero los que pagas).
 */
function PosterMarks({
  mediaType,
  id,
  badge,
  width,
}: {
  mediaType: MediaType;
  id: number;
  badge?: WatchStatus | null;
  width: number;
}) {
  const lib = useLibrary();
  const { myProviders } = useSettings();
  const { list } = useProviderDirectory();
  const item = lib.get(itemKey(mediaType, id));
  const status = badge === undefined ? item?.status ?? null : badge;
  const av = item?.availability;
  const mine = new Set(myProviders);
  const ids = av ? [...av.flatrate, ...av.free] : [];
  const pick = ids.find((p) => mine.has(p)) ?? ids[0];
  const logo = pick != null ? list?.find((p) => p.id === pick) : null;
  const small = width < 100;
  return (
    <>
      <View style={[markStyles.type, small && { top: 4, left: 4 }]} accessibilityLabel={mediaType === 'tv' ? 'Serie' : 'Película'}>
        <Icon name={mediaType === 'tv' ? 'tv' : 'film'} size={small ? 11 : 13} color="#fff" strokeWidth={2.2} />
      </View>
      {status ? <StatusBadge status={status} size={small ? 22 : 26} /> : null}
      {logo && !small ? (
        <View style={markStyles.logo}>
          <ProviderLogo name={logo.name} logoPath={logo.logoPath} size={24} />
        </View>
      ) : null}
    </>
  );
}

const markStyles = StyleSheet.create({
  type: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,13,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logo: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});

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
  textRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  text: { flex: 1, gap: 1 },
  /** Una línea de título con puntos suspensivos: limpio y siempre parejo. */
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.2, color: C.text },
  line: { minHeight: 16 },
  check: { paddingTop: 2 },
});
