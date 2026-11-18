/** Pestaña "Siguiendo": lo que sale esta semana, el siguiente episodio de cada serie y lo pendiente. */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { SollarLogo } from '@/components/brand';
import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { TitleCard } from '@/components/title-card';
import { TokenWarning } from '@/components/token-warning';
import { Button, Empty, Poster, ProgressBar, Screen, Section, T } from '@/components/ui';
import { useCalendar, type CalendarEpisode } from '@/hooks/use-calendar';
import { addDays, dayLabel, todayISO } from '@/lib/dates';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { formatEpisode, nextEpisode, progressOf, totalEpisodes, watchedCount } from '@/lib/progress';
import { availableLabel, myMatches } from '@/lib/providers';
import { getSeason, isDemo, sharpImage } from '@/lib/tmdb';
import type { LibraryItem, TmdbEpisode } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { Touchable } from '@/components/touch';

export default function FollowingScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { items } = useLibrary();
  // Lo que viste más recientemente va primero.
  const watching = items
    .filter((i) => i.mediaType === 'tv' && i.status === 'watching')
    .map((i) => ({ i, last: lastWatched(i) }))
    .sort((a, b) => b.last.localeCompare(a.last))
    .map((x) => x.i);
  const [showAll, setShowAll] = useState(false);
  const watchingShown = showAll ? watching : watching.slice(0, 8);
  const plannedMovies = items.filter((i) => i.mediaType === 'movie' && i.status === 'planned');
  const plannedShows = items.filter((i) => i.mediaType === 'tv' && i.status === 'planned');
  const { myProviders } = useSettings();
  const calendar = useCalendar();
  const weekEnd = addDays(todayISO(), 6);
  const thisWeek = calendar.episodes.filter((e) => e.airDate <= weekEnd);
  // Pendientes que ya puedes ver con lo que pagas: lo más útil para decidir qué ver hoy.
  const readyNow = items.filter(
    (i) => (i.status === 'planned' || i.status === 'paused') && myMatches(i, myProviders).length > 0,
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <SollarLogo size={40} shape="icon" />
        <T variant="title">Siguiendo</T>
      </View>

      {isDemo ? <TokenWarning /> : null}

      {items.length === 0 ? (
        <Empty
          title="Aún no sigues nada"
          message="Busca una serie o película y agrégala a tu lista para empezar a llevar el seguimiento."
          action={<Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} />}
        />
      ) : null}

      {items.length > 0 && myProviders.length === 0 ? (
        <View style={styles.tip}>
          <T variant="label">¿Qué plataformas pagas?</T>
          <T variant="small" muted>
            Elígelas una vez y Sollar te muestra qué de tu lista puedes ver ya, sin pagar extra.
          </T>
          <Button label="Elegir mis plataformas" kind="secondary" onPress={() => router.navigate('/perfil')} />
        </View>
      ) : null}

      {thisWeek.length > 0 ? (
        <Section
          title="Esta semana"
          right={
            <Link href="/calendario" asChild>
              <Touchable hitSlop={8}>
                <T variant="label" style={{ color: C.accentInk }}>
                  Ver calendario
                </T>
              </Touchable>
            </Link>
          }>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
            {thisWeek.slice(0, 8).map((e) => (
              <WeekCard key={`${e.key}:${e.season}:${e.episode}`} e={e} />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {readyNow.length > 0 ? (
        <Section title="Listo para ver en tus plataformas">
          <Shelf items={readyNow} myProviders={myProviders} />
        </Section>
      ) : null}

      {watching.length > 0 ? (
        <Section title="Continúa viendo">
          <View style={styles.upNext}>
            {watchingShown.map((item) => (
              <NextEpisodeRow key={item.key} item={item} upcoming={calendar.nextByKey[item.key]} />
            ))}
          </View>
          {watching.length > watchingShown.length || showAll ? (
            <Button
              label={showAll ? 'Mostrar menos' : `Ver las ${watching.length} series`}
              kind="secondary"
              onPress={() => setShowAll(!showAll)}
            />
          ) : null}
        </Section>
      ) : null}

      {plannedShows.length > 0 ? (
        <Section title="Series por empezar">
          <Shelf items={plannedShows} myProviders={myProviders} />
        </Section>
      ) : null}

      {plannedMovies.length > 0 ? (
        <Section title="Películas por ver">
          <Shelf items={plannedMovies} myProviders={myProviders} />
        </Section>
      ) : null}
    </Screen>
  );
}

/** Tarjeta compacta de un episodio que sale esta semana. */
function WeekCard({ e }: { e: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Touchable>
        {({ pressed }) => (
          <View style={[styles.week, pressed && { opacity: 0.8 }]}>
            <Poster path={e.posterPath} title={e.title} width={44} size="w185" />
            <View style={{ gap: 2, maxWidth: 150 }}>
              <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
                {dayLabel(e.airDate)}
              </T>
              <T variant="label" numberOfLines={1}>
                {e.title}
              </T>
              <T variant="caption" muted>
                {formatEpisode(e.season, e.episode)}
              </T>
            </View>
          </View>
        )}
      </Touchable>
    </Link>
  );
}

/** Fecha del último episodio marcado como visto (o cuándo se agregó la serie). */
function lastWatched(item: LibraryItem): string {
  let last = item.addedAt;
  for (const at of Object.values(item.watchedEpisodes)) if (at > last) last = at;
  return last;
}

/** Datos del episodio (imagen, nombre, sinopsis). Usa la caché de TMDB por temporada. */
function useEpisode(tvId: number, season: number | undefined, episode: number | undefined) {
  const [ep, setEp] = useState<TmdbEpisode | null>(null);
  useEffect(() => {
    if (!season || !episode) return setEp(null);
    let alive = true;
    getSeason(tvId, season)
      .then((s) => alive && setEp(s.episodes.find((e) => e.episode_number === episode) ?? null))
      .catch(() => alive && setEp(null));
    return () => {
      alive = false;
    };
  }, [tvId, season, episode]);
  return ep;
}

/**
 * Tarjeta de "Continúa viendo": la imagen del próximo capítulo con su nombre y de qué trata,
 * el avance de la serie y el botón para marcarlo como visto.
 */
function NextEpisodeRow({ item, upcoming }: { item: LibraryItem; upcoming?: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const { setEpisodes } = useLibrary();
  const nextRaw = nextEpisode(item);
  // Si lo que sigue aún no ha salido, se avisa cuándo sale y no se puede marcar como visto.
  const unaired =
    !!nextRaw &&
    !!upcoming &&
    (nextRaw.season > upcoming.season || (nextRaw.season === upcoming.season && nextRaw.episode >= upcoming.episode));
  const next = unaired ? null : nextRaw;
  const target = next ?? (unaired && upcoming ? { season: upcoming.season, episode: upcoming.episode } : null);
  const ep = useEpisode(item.tmdbId, target?.season, target?.episode);
  const total = totalEpisodes(item.seasons);
  const cardWidth = Math.min(width - 32, 460);
  const still = sharpImage(ep?.still_path, 'still', cardWidth) ?? sharpImage(item.backdropPath, 'backdrop', cardWidth);
  const status = next
    ? formatEpisode(next.season, next.episode)
    : unaired && upcoming
      ? `${formatEpisode(upcoming.season, upcoming.episode)} · sale ${dayLabel(upcoming.airDate).toLowerCase()}`
      : 'Al día';
  const epName = ep?.name && !/^(episodio|episode) \d+$/i.test(ep.name) ? ep.name : null;

  return (
    <View style={styles.upCard}>
      <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(item.tmdbId) } }} asChild>
        <Touchable pressScale={0.98} accessibilityLabel={`${item.title}, ${status}`}>
          <View style={styles.still}>
            {still ? (
              <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            ) : (
              <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
              locations={[0.35, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.stillText}>
              <T variant="caption" numberOfLines={1} style={styles.onImageMuted}>
                {item.title}
              </T>
              <T numberOfLines={1} style={styles.onImageTitle}>
                {status}
                {epName ? ` · ${epName}` : ''}
              </T>
            </View>
            {ep?.runtime ? (
              <View style={styles.runtime}>
                <T variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                  {ep.runtime} min
                </T>
              </View>
            ) : null}
          </View>
        </Touchable>
      </Link>
      <View style={styles.upBody}>
        <View style={{ flex: 1, gap: Space.xs }}>
          {ep?.overview ? (
            <T variant="small" muted numberOfLines={2}>
              {ep.overview}
            </T>
          ) : null}
          <ProgressBar value={progressOf(item)} />
          <T variant="caption" muted>
            {watchedCount(item)} de {total} episodios
          </T>
        </View>
        {next ? (
          <Touchable
            haptic="success"
            pressScale={0.85}
            accessibilityLabel={`Marcar ${formatEpisode(next.season, next.episode)} como visto`}
            onPress={() => setEpisodes(item.key, [next], true)}
            style={styles.check}>
            <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View>
              <Icon name="check" size={24} color={C.onAccent} strokeWidth={2.6} />
            </View>
          </Touchable>
        ) : null}
      </View>
    </View>
  );
}

function Shelf({ items, myProviders }: { items: LibraryItem[]; myProviders: number[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
      {items.map((i) => (
        <TitleCard
          key={i.key}
          id={i.tmdbId}
          mediaType={i.mediaType}
          title={i.title}
          posterPath={i.posterPath}
          subtitle={i.year}
          highlight={availableLabel(i, myProviders)}
          width={110}
        />
      ))}
    </ScrollView>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    tip: {
      ...card(C),
      gap: Space.sm,
      padding: Space.lg,
      borderRadius: Radius.lg,
    },
    row: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      padding: Space.md,
      borderRadius: Radius.lg,
    },
    week: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      padding: Space.sm,
      paddingRight: Space.md,
      borderRadius: Radius.lg,
    },
    check: {
      width: 50,
      height: 50,
      borderRadius: 25,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    upNext: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
    upCard: {
      ...card(C),
      flexGrow: 1,
      flexBasis: 300,
      maxWidth: 460,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    still: { aspectRatio: 16 / 9, width: '100%', backgroundColor: C.fill, justifyContent: 'flex-end' },
    stillText: { padding: Space.md, gap: 2 },
    onImageTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 },
    onImageMuted: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    runtime: {
      position: 'absolute',
      top: Space.sm,
      right: Space.sm,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: Radius.pill,
      paddingHorizontal: Space.sm,
      paddingVertical: 2,
    },
    upBody: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md },
  });
