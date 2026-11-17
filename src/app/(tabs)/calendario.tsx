/**
 * Pestaña "Calendario": cuándo salen los episodios de tus series y qué se estrena.
 *
 * - Mis series: los próximos episodios por día, con una tira de la semana para filtrar.
 * - Estrenos: películas de tu lista por estrenarse, lo reciente en tus plataformas y lo que
 *   llega a cines.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { card } from '@/components/glass';
import { Grid, TitleCard } from '@/components/title-card';
import { Button, Chip, Empty, Loading, Poster, Screen, Section, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useAvailabilityFor } from '@/hooks/use-availability';
import { useCalendar, type CalendarEpisode, type CalendarMovie } from '@/hooks/use-calendar';
import { addDays, countdown, dayLabel, fromISO, longDate, shortDay, todayISO } from '@/lib/dates';
import { itemKey } from '@/lib/library-item';
import { formatEpisode } from '@/lib/progress';
import { availableLabel } from '@/lib/providers';
import { getNewOnProviders, getUpcomingMovies, isDemo } from '@/lib/tmdb';
import type { MediaType, TmdbSearchResult } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { useColors, useStyles } from '@/store/theme';

type Tab = 'series' | 'estrenos';

export default function CalendarScreen() {
  const [tab, setTab] = useState<Tab>('series');
  return (
    <Screen>
      <T variant="title">Calendario</T>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <Chip label="Mis series" selected={tab === 'series'} onPress={() => setTab('series')} />
        <Chip label="Estrenos" selected={tab === 'estrenos'} onPress={() => setTab('estrenos')} />
      </View>
      {tab === 'series' ? <MySeries /> : <Premieres />}
    </Screen>
  );
}

// --- Mis series ---

function MySeries() {
  const { loading, failed, episodes, watchedShows } = useCalendar();
  const [day, setDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const groups: { date: string; items: CalendarEpisode[] }[] = [];
    for (const e of episodes) {
      if (day && e.airDate !== day) continue;
      const last = groups[groups.length - 1];
      if (last?.date === e.airDate) last.items.push(e);
      else groups.push({ date: e.airDate, items: [e] });
    }
    return groups;
  }, [episodes, day]);

  if (watchedShows === 0) {
    return (
      <Empty
        title="Sigue una serie"
        message="Cuando agregues series a tu lista, aquí verás qué día sale cada episodio nuevo."
        action={<Button label="Buscar series" onPress={() => router.navigate('/buscar')} />}
      />
    );
  }
  if (loading) return <Loading />;
  if (failed) {
    return <Empty title="No se pudo cargar" message="Revisa tu conexión e inténtalo de nuevo en un momento." />;
  }

  const days = new Set(episodes.map((e) => e.airDate));
  return (
    <View style={{ gap: Space.xl }}>
      <WeekStrip marked={days} selected={day} onSelect={(d) => setDay(d === day ? null : d)} />

      {byDay.length === 0 ? (
        <Empty
          title={day ? 'Nada ese día' : 'Nada programado'}
          message={
            day
              ? 'Ninguna de tus series estrena episodio ese día.'
              : 'Ninguna de tus series tiene episodios anunciados en los próximos cuatro meses.'
          }
        />
      ) : (
        byDay.map((g) => (
          <View key={g.date} style={{ gap: Space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space.sm }}>
              <T variant="heading">{dayLabel(g.date)}</T>
              <T variant="small" muted>
                {longDate(g.date)}
              </T>
            </View>
            {g.items.map((e) => (
              <EpisodeRow key={`${e.key}:${e.season}:${e.episode}`} e={e} />
            ))}
          </View>
        ))
      )}

      {isDemo ? (
        <T variant="caption" muted>
          Fechas de ejemplo. Con TMDB conectado verás las fechas reales de cada episodio.
        </T>
      ) : null}
    </View>
  );
}

/** Los próximos siete días; un punto marca los días con episodios. */
function WeekStrip({
  marked,
  selected,
  onSelect,
}: {
  marked: Set<string>;
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const today = todayISO();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <View style={styles.week}>
      {week.map((d) => {
        const on = selected === d;
        const has = marked.has(d);
        return (
          <Pressable
            key={d}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${longDate(d)}${has ? ', con episodios' : ''}`}
            style={({ pressed }) => [styles.day, pressed && { opacity: 0.75 }]}>
            {on ? (
              <LinearGradient
                colors={[C.g1, C.g2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
              />
            ) : null}
            <T variant="caption" style={{ color: on ? C.onAccent : C.textMuted, fontWeight: '600' }}>
              {d === today ? 'hoy' : shortDay(d)}
            </T>
            <T style={{ fontSize: 18, lineHeight: 22, fontWeight: '800', color: on ? C.onAccent : C.text }}>
              {fromISO(d).getDate()}
            </T>
            <View style={[styles.dot, { backgroundColor: has ? (on ? C.onAccent : C.accent) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const KIND_LABEL = { premiere: 'Estreno de temporada', finale: 'Final de temporada', standard: null } as const;

function EpisodeRow({ e }: { e: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const badge = KIND_LABEL[e.kind];
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.row, pressed && { opacity: 0.8 }]}>
            <Poster path={e.posterPath} title={e.title} width={52} size="w185" />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="label" numberOfLines={1}>
                {e.title}
              </T>
              <T variant="small" muted numberOfLines={1}>
                {formatEpisode(e.season, e.episode)}
                {e.name ? ` · ${e.name}` : ''}
              </T>
              {badge ? (
                <View style={styles.badge}>
                  <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
                    {badge}
                  </T>
                </View>
              ) : null}
            </View>
            <T variant="caption" style={{ color: C.textMuted, fontWeight: '600' }}>
              {countdown(e.airDate)}
            </T>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

// --- Estrenos ---

function Premieres() {
  const styles = useStyles(makeStyles);
  const { myProviders } = useSettings();
  const { releases, loading: loadingLib } = useCalendar();
  const [fresh, setFresh] = useState<TmdbSearchResult[] | null>(null);
  const [upcoming, setUpcoming] = useState<TmdbSearchResult[]>([]);
  const providersKey = myProviders.join(',');

  useEffect(() => {
    let cancelled = false;
    setFresh(null);
    getNewOnProviders(myProviders)
      .then((r) => !cancelled && setFresh(r.slice(0, 18)))
      .catch(() => !cancelled && setFresh([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providersKey]);

  useEffect(() => {
    getUpcomingMovies()
      .then((r) => setUpcoming(r.slice(0, 15)))
      .catch(() => setUpcoming([]));
  }, []);

  const availability = useAvailabilityFor(
    (fresh ?? []).map((r) => ({ id: r.id, mediaType: r.media_type as MediaType })),
  );

  return (
    <View style={{ gap: Space.xl }}>
      {!loadingLib && releases.length > 0 ? (
        <Section title="De tu lista, por estrenarse">
          <View style={{ gap: Space.sm }}>
            {releases.map((m) => (
              <MovieRow key={m.key} m={m} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Reciente en tus plataformas">
        {myProviders.length === 0 ? (
          <View style={styles.tip}>
            <T variant="small" muted>
              Elige las plataformas que pagas y aquí verás lo más nuevo que puedes ver sin pagar extra.
            </T>
            <Button label="Elegir mis plataformas" kind="secondary" onPress={() => router.navigate('/perfil')} />
          </View>
        ) : fresh == null ? (
          <Loading />
        ) : fresh.length === 0 ? (
          <T variant="small" muted>
            No encontramos estrenos recientes en tus plataformas.
          </T>
        ) : (
          <>
            <Grid>
              {fresh.map((r) => {
                const type = r.media_type as MediaType;
                return (
                  <TitleCard
                    key={`${type}:${r.id}`}
                    id={r.id}
                    mediaType={type}
                    title={r.title ?? r.name ?? ''}
                    posterPath={r.poster_path}
                    subtitle={type === 'tv' ? 'Serie' : 'Película'}
                    highlight={availableLabel({ availability: availability[itemKey(type, r.id)] }, myProviders)}
                  />
                );
              })}
            </Grid>
            <T variant="caption" muted>
              Datos de JustWatch
            </T>
          </>
        )}
      </Section>

      {upcoming.length > 0 ? (
        <Section title="Próximamente en cines">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
            {upcoming.map((r) => (
              <TitleCard
                key={r.id}
                id={r.id}
                mediaType="movie"
                title={r.title ?? ''}
                posterPath={r.poster_path}
                subtitle={r.release_date ? dayLabel(r.release_date) : null}
              />
            ))}
          </ScrollView>
        </Section>
      ) : null}
    </View>
  );
}

function MovieRow({ m }: { m: CalendarMovie }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'movie', id: String(m.tmdbId) } }} asChild>
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.row, pressed && { opacity: 0.8 }]}>
            <Poster path={m.posterPath} title={m.title} width={52} size="w185" />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="label" numberOfLines={1}>
                {m.title}
              </T>
              <T variant="small" muted>
                {longDate(m.releaseDate)}
              </T>
            </View>
            <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
              {countdown(m.releaseDate)}
            </T>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    week: { flexDirection: 'row', gap: 6 },
    day: {
      ...card(C),
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: Space.sm,
      borderRadius: Radius.md,
      overflow: 'hidden',
    },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
    row: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      padding: Space.sm,
      paddingRight: Space.md,
      borderRadius: Radius.lg,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: C.accentSoft,
      borderRadius: Radius.pill,
      paddingHorizontal: Space.sm,
      paddingVertical: 2,
      marginTop: 2,
    },
    tip: { ...card(C), padding: Space.lg, gap: Space.md, borderRadius: Radius.lg },
  });
