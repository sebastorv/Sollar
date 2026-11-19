/**
 * Progreso de tus series, como la pantalla "Progress" de Bingebase: lo que sigue, lo que ya
 * tienes al día, lo que quieres ver y lo terminado. Cada serie muestra su imagen, el próximo
 * episodio, una barra por temporada y cuánto falta (episodios, porcentaje y horas).
 */

import { HScroll } from './hscroll';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { formatDuration, formatEpisode, nextEpisode, totalEpisodes } from '@/lib/progress';
import { sharpImage } from '@/lib/tmdb';
import { type LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

import { glassFill } from './glass';
import { Icon, type IconName } from './icons';
import { Touchable } from './touch';
import { T } from './ui';

type Group = 'next' | 'caught' | 'planned' | 'done';
const GROUPS: { k: Group; label: string; icon: IconName }[] = [
  { k: 'next', label: 'Siguiente', icon: 'playSolid' },
  { k: 'caught', label: 'Al día', icon: 'check' },
  { k: 'planned', label: 'Por ver', icon: 'bookmark' },
  { k: 'done', label: 'Terminadas', icon: 'sparkle' },
];

function lastSeen(i: LibraryItem) {
  let max = i.watchedAt ?? '';
  for (const at of Object.values(i.watchedEpisodes)) if (at > max) max = at;
  return max;
}

function groupOf(i: LibraryItem): Group | null {
  if (i.mediaType !== 'tv') return i.status === 'planned' ? 'planned' : null;
  if (i.status === 'completed') return 'done';
  if (i.status === 'planned') return 'planned';
  if (i.status === 'watching' || i.status === 'paused') return nextEpisode(i) ? 'next' : 'caught';
  return null;
}

const PAGE = 40;

export function ProgressView() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { items } = useLibrary();
  const [group, setGroup] = useState<Group>('next');
  const [limit, setLimit] = useState(PAGE);

  const byGroup = useMemo(() => {
    const out: Record<Group, LibraryItem[]> = { next: [], caught: [], planned: [], done: [] };
    for (const i of items) {
      const g = groupOf(i);
      if (g) out[g].push(i);
    }
    for (const g of Object.keys(out) as Group[]) out[g].sort((a, b) => lastSeen(b).localeCompare(lastSeen(a)));
    return out;
  }, [items]);

  const list = byGroup[group];

  return (
    <View style={{ gap: Space.lg }}>
      <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
        {GROUPS.map((g) => {
          const on = g.k === group;
          return (
            <Touchable
              key={g.k}
              haptic="select"
              onPress={() => {
                setGroup(g.k);
                setLimit(PAGE);
              }}
              style={[styles.chip, on ? { overflow: 'hidden', borderColor: 'transparent' } : glassFill(C)]}>
              {on ? <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
              <View>
                <Icon name={g.icon} size={16} color={on ? C.onAccent : C.accentInk} strokeWidth={2.4} />
              </View>
              <T style={{ fontSize: 16, fontWeight: '700', color: on ? C.onAccent : C.text }}>{g.label}</T>
              <T style={{ fontSize: 15, fontWeight: '600', color: on ? 'rgba(255,255,255,0.8)' : C.textMuted }}>
                {byGroup[g.k].length}
              </T>
            </Touchable>
          );
        })}
      </HScroll>

      {list.length === 0 ? (
        <T muted>
          {group === 'next'
            ? 'Cuando empieces una serie, aquí verás qué episodio sigue.'
            : group === 'caught'
              ? 'Aquí quedan las series que tienes al día, esperando episodios nuevos.'
              : group === 'planned'
                ? 'Lo que marques como "Por ver" aparece aquí.'
                : 'Tus series terminadas aparecen aquí.'}
        </T>
      ) : (
        <View style={styles.listBox}>
          {list.slice(0, limit).map((i, idx) => (
            <ProgressRow key={i.key} item={i} first={idx === 0} />
          ))}
        </View>
      )}
      {list.length > limit ? (
        <Touchable haptic="light" onPress={() => setLimit(limit + PAGE)} style={{ alignSelf: 'center', padding: Space.md }}>
          <T variant="label" style={{ color: C.accentInk }}>
            Mostrar más ({list.length - limit})
          </T>
        </Touchable>
      ) : null}
    </View>
  );
}

function ProgressRow({ item, first }: { item: LibraryItem; first: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const { width } = useWindowDimensions();
  const imgW = width >= 720 ? 220 : Math.round(width * 0.36);
  const isTv = item.mediaType === 'tv';
  const seasons = item.seasons.filter((s) => s.seasonNumber > 0 && s.episodeCount > 0);
  const total = totalEpisodes(seasons);
  const seenIn = (n: number) => Object.keys(item.watchedEpisodes).filter((k) => k.startsWith(`${n}:`)).length;
  const seen = seasons.reduce((a, s) => a + Math.min(seenIn(s.seasonNumber), s.episodeCount), 0);
  const next = isTv ? nextEpisode(item) : null;
  const left = total - seen;
  const pct = total ? Math.round((seen / total) * 100) : 0;
  const img = sharpImage(item.backdropPath ?? item.posterPath, item.backdropPath ? 'backdrop' : 'poster', imgW);
  const runtime = item.runtime ?? 0;

  return (
    <Touchable
      haptic="light"
      pressScale={0.98}
      onPress={() => router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: item.mediaType, id: String(item.tmdbId) } })}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: C.border }]}>
      <View style={[styles.still, { width: imgW }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T numberOfLines={2} style={{ fontSize: 17, lineHeight: 21, fontWeight: '800' }}>
          {item.title}
        </T>
        {isTv ? (
          <>
            <T numberOfLines={1} style={{ fontSize: 14, color: C.textMuted }}>
              {next ? formatEpisode(next.season, next.episode) : 'Al día'}
            </T>
            {total ? (
              <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 4 }}>
                {seasons.map((s) => {
                  const f = Math.min(seenIn(s.seasonNumber), s.episodeCount) / s.episodeCount;
                  return (
                    <View key={s.seasonNumber} style={{ flex: s.episodeCount, borderRadius: 3, overflow: 'hidden', backgroundColor: C.fill }}>
                      <View style={{ width: `${Math.round(f * 100)}%`, height: '100%', backgroundColor: C.accent }} />
                    </View>
                  );
                })}
              </View>
            ) : null}
            <T numberOfLines={1} style={{ fontSize: 13, color: C.textFaint, marginTop: 2 }}>
              {seen} de {total} · {pct} %{left > 0 && runtime ? ` · ~${formatDuration(left * runtime)} restantes` : ''}
            </T>
          </>
        ) : (
          <T style={{ fontSize: 14, color: C.textMuted }}>
            Película{runtime ? ` · ${formatDuration(runtime)}` : ''}
          </T>
        )}
      </View>
      {isTv && next ? (
        <Touchable
          haptic="success"
          pressScale={0.85}
          onPress={() => lib.setEpisodes(item.key, [next], true)}
          accessibilityLabel={`Marcar ${formatEpisode(next.season, next.episode)} como visto`}
          style={styles.check}>
          <Icon name="check" size={24} color={C.text} strokeWidth={1.7} />
        </Touchable>
      ) : null}
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: Space.lg,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    listBox: { ...glassFill(C), borderRadius: 24, paddingHorizontal: Space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md },
    still: { aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: C.fill },
    check: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
