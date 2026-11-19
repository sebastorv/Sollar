/**
 * Pestaña "Siguiendo": lo que toca ver ahora.
 *
 * - Continúa viendo: tarjetas anchas con la imagen del próximo capítulo, cuánto dura, cuántos
 *   faltan y el ✓ para marcarlo. Primero lo último que viste.
 * - Racha: días seguidos viendo algo.
 * - Esta semana, Listo en tus plataformas, Empieza a ver y Películas por ver, en estantes.
 * Los estantes se dibujan a medida que se desplazan, así aguantan miles de títulos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassButton } from '@/components/glass';
import { NEWS_SEEN_KEY } from '@/lib/news';
import { HList } from '@/components/hscroll';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { SollarLogo } from '@/components/brand';
import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { TitleCard } from '@/components/title-card';
import { TokenWarning } from '@/components/token-warning';
import { Touchable } from '@/components/touch';
import { Button, Empty, Poster, Screen, Section, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useCalendar, type CalendarEpisode } from '@/hooks/use-calendar';
import { addDays, dayLabel, daysFromToday, toISO, todayISO } from '@/lib/dates';
import { formatEpisode, nextEpisode, totalEpisodes, watchedCount } from '@/lib/progress';
import { availableLabel, myMatches } from '@/lib/providers';
import { getSeason, isDemo, sharpImage } from '@/lib/tmdb';
import type { LibraryItem, TmdbEpisode } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useColors, useStyles } from '@/store/theme';

export default function FollowingScreen() {
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const { items } = lib;
  const { myProviders } = useSettings();
  const calendar = useCalendar();

  const watching = useMemo(
    () =>
      items
        .filter((i) => i.mediaType === 'tv' && i.status === 'watching')
        .map((i) => ({ i, last: lastWatched(i) }))
        .sort((a, b) => b.last.localeCompare(a.last))
        .map((x) => x.i),
    [items],
  );
  const plannedShows = useMemo(() => items.filter((i) => i.mediaType === 'tv' && i.status === 'planned'), [items]);
  const plannedMovies = useMemo(() => items.filter((i) => i.mediaType === 'movie' && i.status === 'planned'), [items]);
  // Pendientes que ya puedes ver con lo que pagas: lo más útil para decidir qué ver hoy.
  const readyNow = useMemo(
    () => items.filter((i) => (i.status === 'planned' || i.status === 'paused') && myMatches(i, myProviders).length > 0),
    [items, myProviders],
  );
  const wideScreen = useWindowDimensions().width >= 720;
  const weekEnd = addDays(todayISO(), 6);
  const thisWeek = calendar.episodes.filter((e) => e.airDate <= weekEnd);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        {/* En computador el logo ya está suelto arriba a la izquierda. */}
        {wideScreen ? null : <SollarLogo size={40} shape="icon" />}
        <T variant="title" style={{ flex: 1 }}>
          Siguiendo
        </T>
        <NewsBell />
      </View>

      {isDemo ? <TokenWarning /> : null}

      {calendar.fresh.length > 0 ? (
        <View style={styles.fresh}>
          <View style={styles.freshDot} />
          <T variant="small" style={{ flex: 1 }}>
            <T variant="small" style={{ fontWeight: '800' }}>
              {calendar.fresh.length === 1 ? 'Episodio nuevo' : `${calendar.fresh.length} series con episodio nuevo`}
            </T>
            {': '}
            {calendar.fresh
              .slice(0, 3)
              .map((f) => lib.get(f.key)?.title)
              .filter(Boolean)
              .join(', ')}
            {calendar.fresh.length > 3 ? ' y más' : ''}
          </T>
        </View>
      ) : null}

      {items.length === 0 ? (
        <Empty
          title="Aún no sigues nada"
          message="Busca una serie o película y agrégala a tu lista, o trae tu historial desde Perfil."
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

      {watching.length > 0 ? (
        <Section title="Continúa viendo" onPress={() => router.navigate('/lista')}>
          <HList
            data={watching}
            keyExtractor={(i) => i.key}
            renderItem={({ item }) => <UpNextCard item={item} upcoming={calendar.nextByKey[item.key]} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Space.md }}
            initialNumToRender={4}
            windowSize={5}
            style={styles.bleed}
          />
        </Section>
      ) : null}

      {items.length > 0 ? <StreakCard items={items} /> : null}

      {thisWeek.length > 0 ? (
        <Section title="Esta semana" onPress={() => router.navigate('/calendario')}>
          <HList
            data={thisWeek.slice(0, 20)}
            keyExtractor={(e) => `${e.key}:${e.season}:${e.episode}`}
            renderItem={({ item }) => <WeekCard e={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Space.md }}
            style={styles.bleed}
          />
        </Section>
      ) : null}

      {readyNow.length > 0 ? (
        <Section title="Listo en tus plataformas">
          <PosterShelf items={readyNow} myProviders={myProviders} />
        </Section>
      ) : null}

      {plannedShows.length > 0 ? (
        <Section title="Empieza a ver">
          <PosterShelf
            items={plannedShows}
            myProviders={myProviders}
            onCheck={(i) => {
              const first = nextEpisode(i);
              if (first) lib.setEpisodes(i.key, [first], true);
            }}
          />
        </Section>
      ) : null}

      {plannedMovies.length > 0 ? (
        <Section title="Películas por ver">
          <PosterShelf items={plannedMovies} myProviders={myProviders} onCheck={(i) => lib.setMovieWatched(i.key, true)} />
        </Section>
      ) : null}
    </Screen>
  );
}

/** Fecha del último episodio marcado como visto (o cuándo se agregó la serie). */
function lastWatched(item: LibraryItem): string {
  let last = item.addedAt;
  for (const at of Object.values(item.watchedEpisodes)) if (at > last) last = at;
  return last;
}

/** "hoy", "1 d", "3 sem", "2 m": hace cuánto viste la serie por última vez. */
function since(iso: string): string {
  const days = -daysFromToday(toISO(new Date(iso)));
  if (days <= 0) return 'hoy';
  if (days < 14) return `${days} d`;
  if (days < 60) return `${Math.round(days / 7)} sem`;
  if (days < 730) return `${Math.round(days / 30)} m`;
  return `${Math.round(days / 365)} a`;
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

/** Tarjeta ancha de "Continúa viendo", al estilo de Trakt con el toque de Sollar. */
function UpNextCard({ item, upcoming }: { item: LibraryItem; upcoming?: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { width: screen } = useWindowDimensions();
  const { setEpisodes } = useLibrary();
  const nextRaw = nextEpisode(item);
  // Si lo que sigue aún no ha salido, se dice cuándo sale y no se puede marcar.
  const unaired =
    !!nextRaw &&
    !!upcoming &&
    (nextRaw.season > upcoming.season || (nextRaw.season === upcoming.season && nextRaw.episode >= upcoming.episode));
  const next = unaired ? null : nextRaw;
  const target = next ?? (unaired && upcoming ? { season: upcoming.season, episode: upcoming.episode } : null);
  const ep = useEpisode(item.tmdbId, target?.season, target?.episode);
  const width = Math.min(Math.max(screen * 0.78, 260), 340);
  const still = sharpImage(ep?.still_path, 'still', width) ?? sharpImage(item.backdropPath, 'backdrop', width);
  const total = totalEpisodes(item.seasons);
  const seen = watchedCount(item);
  const left = Math.max(0, total - seen);
  const epName = ep?.name && !/^(episodio|episode) \d+$/i.test(ep.name) ? ep.name : null;
  const code = target ? formatEpisode(target.season, target.episode) : 'Al día';
  const isNew = ep?.air_date ? daysFromToday(ep.air_date) >= -7 && daysFromToday(ep.air_date) <= 0 : false;

  return (
    <View style={{ width, gap: Space.sm }}>
      <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(item.tmdbId) } }} asChild>
        <Touchable pressScale={0.97} accessibilityLabel={`${item.title}, ${code}`} style={styles.still}>
          {still ? (
            <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.fill }]} />
          )}
          {/* Píldora de vidrio con la duración y el avance de la serie. */}
          <View style={styles.pill}>
            <View style={[styles.pillFill, { width: `${total ? Math.round((seen / total) * 100) : 0}%` }]} />
            <T style={styles.pillText}>{ep?.runtime ? `${ep.runtime} min` : ' '}</T>
            <T style={styles.pillText}>
              {unaired && upcoming
                ? `Sale ${dayLabel(upcoming.airDate).toLowerCase()}`
                : isNew
                  ? '• Nuevo'
                  : `${left} ${left === 1 ? 'falta' : 'faltan'} · ${since(lastWatched(item))}`}
            </T>
          </View>
        </Touchable>
      </Link>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm }}>
        <View style={{ flex: 1 }}>
          <T numberOfLines={1} style={styles.cardTitle}>
            {item.title}
          </T>
          <T variant="small" muted numberOfLines={1}>
            {code}
            {epName ? ` · ${epName}` : ''}
          </T>
        </View>
        {next ? (
          <Touchable
            haptic="success"
            pressScale={0.8}
            hitSlop={10}
            accessibilityLabel={`Marcar ${code} como visto`}
            onPress={() => setEpisodes(item.key, [next], true)}
            style={styles.checkBtn}>
            <Icon name="check" size={20} color={C.onAccent} strokeWidth={2.4} />
          </Touchable>
        ) : null}
      </View>
    </View>
  );
}

/** Racha: días seguidos con algo visto, y los últimos 7 días como barritas. */
function StreakCard({ items }: { items: LibraryItem[] }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { streak, week } = useMemo(() => {
    const days = new Set<string>();
    for (const i of items) {
      if (i.watchedAt) days.add(toISO(new Date(i.watchedAt)));
      for (const at of Object.values(i.watchedEpisodes)) days.add(toISO(new Date(at)));
    }
    const today = todayISO();
    // La racha sigue viva si viste algo hoy o ayer.
    let d = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(d)) {
      n++;
      d = addDays(d, -1);
    }
    return { streak: n, week: Array.from({ length: 7 }, (_, k) => days.has(addDays(today, k - 6))) };
  }, [items]);

  return (
    <View style={styles.streak}>
      <View style={styles.flame}>
        <View>
          <Icon name="flame" size={26} color={streak > 0 ? C.accent : C.textFaint} filled strokeWidth={1.6} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <T style={styles.cardTitle}>
          {streak > 0 ? `Racha de ${streak} ${streak === 1 ? 'día' : 'días'}` : 'Empieza una racha'}
        </T>
        <T variant="caption" muted>
          {streak > 0 ? 'Mira algo hoy para no perderla.' : 'Marca un episodio o una película hoy.'}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end' }}>
        {week.map((on, k) => (
          <View
            key={k}
            style={{
              width: 7,
              height: k === 6 ? 26 : 20,
              borderRadius: 4,
              backgroundColor: on ? C.accent : C.fill,
              borderWidth: k === 6 ? 1.5 : 0,
              borderColor: C.accentLine,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Estante de carátulas; con ✓ opcional junto al título. */
function PosterShelf({
  items,
  myProviders,
  onCheck,
}: {
  items: LibraryItem[];
  myProviders: number[];
  onCheck?: (i: LibraryItem) => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <HList
      data={items}
      keyExtractor={(i) => i.key}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Space.md }}
      initialNumToRender={6}
      windowSize={5}
      style={styles.bleed}
      renderItem={({ item: i }) => {
        const first = i.mediaType === 'tv' ? nextEpisode(i) : null;
        return (
          <TitleCard
            id={i.tmdbId}
            mediaType={i.mediaType}
            title={i.title}
            posterPath={i.posterPath}
            subtitle={first ? formatEpisode(first.season, first.episode) : i.year}
            width={124}
            onCheck={onCheck ? () => onCheck(i) : undefined}
            checkLabel={i.mediaType === 'tv' ? `Marcar el primer episodio de ${i.title}` : `Marcar ${i.title} como vista`}
          />
        );
      }}
    />
  );
}

/** Tarjeta compacta de un episodio que sale esta semana. */
/** Lo que sale esta semana: imagen del episodio, el día en una etiqueta y "Estreno" o "Final". */
function WeekCard({ e }: { e: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const img = sharpImage(e.stillPath ?? e.posterPath, e.stillPath ? 'backdrop' : 'poster', 260);
  const today = e.airDate === todayISO();
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Touchable style={{ width: 260, gap: 8 }} pressScale={0.97}>
        <View style={[styles.weekStill]}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
          <View style={styles.weekTags}>
            <View style={styles.weekTag}>
              {today ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} /> : null}
              <T style={styles.weekTagText}>{dayLabel(e.airDate)}</T>
            </View>
            {e.kind !== 'standard' ? (
              <View style={styles.weekTag}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: e.kind === 'premiere' ? '#5AB4FF' : '#FFB23F' }} />
                <T style={styles.weekTagText}>{e.kind === 'premiere' ? 'Estreno' : 'Final'}</T>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ gap: 1 }}>
          <T numberOfLines={1} style={{ fontSize: 16, fontWeight: '800' }}>
            {e.title}
          </T>
          <T numberOfLines={1} style={{ fontSize: 14, color: C.textMuted }}>
            {formatEpisode(e.season, e.episode)}
            {e.name ? ` · ${e.name}` : ''}
          </T>
        </View>
      </Touchable>
    </Link>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    tip: { ...card(C), gap: Space.sm, padding: Space.lg, borderRadius: Radius.lg },
    fresh: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      padding: Space.md,
      borderRadius: Radius.lg,
      backgroundColor: C.accentSoft,
    },
    freshDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
    weekStill: { width: 260, aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: C.fill },
    weekTags: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', gap: 6 },
    weekTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(12,11,15,0.6)',
    },
    weekTagText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#fff' },
    // Los estantes llegan al borde de la pantalla, como en las apps de streaming.
    bleed: { marginHorizontal: -Space.lg, paddingHorizontal: Space.lg, flexGrow: 0 },
    still: {
      aspectRatio: 16 / 9,
      width: '100%',
      borderRadius: Radius.lg,
      overflow: 'hidden',
      backgroundColor: C.fill,
      justifyContent: 'flex-end',
    },
    pill: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      margin: Space.sm,
      paddingHorizontal: Space.md,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(20,16,28,0.55)',
      overflow: 'hidden',
    },
    pillFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.16)' },
    pillText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '700' },
    cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.3, color: C.text },
    checkBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streak: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      padding: Space.lg,
      borderRadius: Radius.lg,
    },
    flame: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.fill,
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
  });

/** Campana de Novedades: un punto de color cuando hay estrenos desde la última vez que entraste. */
function NewsBell() {
  const C = useColors();
  const [dot, setDot] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(NEWS_SEEN_KEY)
      .then((seen) => {
        // Los lunes y jueves suelen llegar estrenos: si no has entrado en tres días, hay novedades.
        setDot(!seen || Date.now() - Date.parse(seen) > 3 * 86400_000);
      })
      .catch(() => setDot(true));
  }, []);
  return (
    <View>
      <GlassButton
        icon="bell"
        label="Novedades"
        onPress={() => {
          setDot(false);
          router.push('/novedades');
        }}
      />
      {dot ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: C.accent,
            borderWidth: 2,
            borderColor: C.bg,
          }}
        />
      ) : null}
    </View>
  );
}
