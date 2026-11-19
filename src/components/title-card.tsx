import { Link } from 'expo-router';
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { STATUS_LABEL, STATUS_ORDER, type Availability, type MediaType, type WatchStatus } from '@/lib/types';
import { tr } from '@/i18n';
import { getMovie, getTv } from '@/lib/tmdb';
import { newItemFromMovie, newItemFromTv } from '@/lib/library-item';
import { anchorOf, BubbleMenu, type Anchor } from './sheet';

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
  availability,
  width = 120,
  onCheck,
  checkLabel,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  subtitle?: string | null;
  /** Estado en tu lista: se muestra como una píldora pequeña al pie de la carátula. */
  badge?: WatchStatus | null;
  /** Texto destacado bajo el título (por ejemplo, tu nota). */
  highlight?: string | null;
  /** Dónde está, cuando el título no está en tu lista (búsqueda, calendario). */
  availability?: Availability | null;
  width?: number;
  /** Botón ✓ junto al título (marcar como visto, empezar la serie). */
  onCheck?: () => void;
  checkLabel?: string;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: mediaType, id: String(id) } }} asChild>
      <Touchable style={{ width, gap: 14 }} accessibilityLabel={title}>
        <View>
          <Poster path={posterPath} title={title} width={width} />
          <PosterMarks mediaType={mediaType} id={id} title={title} badge={badge} width={width} availability={availability} />
        </View>
        <View style={styles.textRow}>
          <View style={styles.text}>
            <T numberOfLines={1} style={styles.title}>
              {title}
            </T>
            <View style={styles.subRow}>
              <View accessibilityLabel={mediaType === 'tv' ? tr('Serie') : tr('Película')}>
                <Icon name={mediaType === 'tv' ? 'tv' : 'film'} size={13} color={C.textMuted} strokeWidth={2.2} />
              </View>
              <T variant="caption" muted numberOfLines={1} style={[styles.line, { flex: 1 }]}>
                {subtitle ?? ' '}
              </T>
            </View>
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

/** Píldora oscura con el ícono de tu estado, montada sobre el borde de abajo (como Trakt). */
export function StatusBadge({ status, size = 24 }: { status: WatchStatus; size?: number }) {
  const C = useColors();
  const done = status === 'completed';
  return (
    <View pointerEvents="none" style={[markStyles.statusWrap, { bottom: -Math.round(size * 0.42) }]}>
      <View
        accessibilityLabel={tr(STATUS_LABEL[status])}
        style={[markStyles.status, { height: size, minWidth: size * 1.7, borderRadius: size / 2, backgroundColor: done ? C.accent : C.mode === 'dark' ? '#3A3846' : 'rgba(22,20,28,0.92)' }]}>
        <Icon name={done ? 'checks' : STATUS_ICON[status]} size={size * 0.6} color={done ? C.onAccent : '#fff'} filled={status === 'planned'} strokeWidth={2.6} />
      </View>
    </View>
  );
}

/**
 * Marcas sobre la carátula, como Trakt: el menú ⋮ arriba a la derecha, el logo del servicio
 * abajo a la izquierda y tu estado en una píldora sobre el borde de abajo.
 */
function PosterMarks({
  mediaType,
  id,
  title,
  badge,
  width,
  availability,
}: {
  mediaType: MediaType;
  id: number;
  title: string;
  badge?: WatchStatus | null;
  width: number;
  availability?: Availability | null;
}) {
  const lib = useLibrary();
  const { myProviders } = useSettings();
  const { list } = useProviderDirectory();
  const key = itemKey(mediaType, id);
  const item = lib.get(key);
  const status = badge === undefined ? item?.status ?? null : badge;
  const av = item?.availability ?? availability;
  const mine = new Set(myProviders);
  const ids = av ? [...av.flatrate, ...av.free] : [];
  const pick = ids.find((p) => mine.has(p)) ?? ids[0];
  const logo = pick != null ? list?.find((p) => p.id === pick) : null;
  const small = width < 100;
  const [menu, setMenu] = useState<Anchor | null>(null);

  async function add(st: WatchStatus) {
    try {
      const data = mediaType === 'tv' ? newItemFromTv(await getTv(id), st) : newItemFromMovie(await getMovie(id), st);
      lib.save({ ...data, posterPath: data.posterPath ?? null });
    } catch {
      // Sin conexión: no se guarda.
    }
  }

  return (
    <>
      {!small ? (
        <Touchable
          haptic="select"
          pressScale={0.85}
          hitSlop={6}
          accessibilityLabel={`${tr('Opciones')}: ${title}`}
          onPress={async (e) => {
            (e as unknown as { preventDefault?: () => void }).preventDefault?.();
            e.stopPropagation?.();
            setMenu(await anchorOf(e, { x: 0, y: 0, width: 0, height: 0 }));
          }}
          style={markStyles.more}>
          <Icon name="moreV" size={18} color="#fff" />
        </Touchable>
      ) : null}
      {logo && !small ? (
        <View style={markStyles.logo} pointerEvents="none">
          <ProviderLogo name={logo.name} logoPath={logo.logoPath} size={22} />
        </View>
      ) : null}
      {status ? <StatusBadge status={status} size={small ? 20 : 24} /> : null}
      <BubbleMenu
        anchor={menu}
        title={title}
        onClose={() => setMenu(null)}
        items={[
          ...STATUS_ORDER.map((st) => ({
            label: STATUS_LABEL[st],
            icon: STATUS_ICON[st],
            on: item?.status === st,
            onPress: () => (item ? lib.setStatus(key, st) : add(st)),
          })),
          ...(item
            ? [
                'divider' as const,
                { label: item.favorite ? 'Quitar de favoritos' : 'Favorito', icon: 'heart' as IconName, on: !!item.favorite, onPress: () => lib.toggleFavorite(key) },
                { label: 'Quitar de mi lista', icon: 'trash' as IconName, danger: true, onPress: () => lib.remove(key) },
              ]
            : []),
        ]}
      />
    </>
  );
}

const markStyles = StyleSheet.create({
  more: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // Solo los tres puntos, sin círculo; una sombra suave los separa de carátulas claras.
    filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.75))',
  },
  statusWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  status: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 6,
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
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  check: { paddingTop: 2 },
});
