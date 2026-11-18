/**
 * Pestaña "Calendario": cuándo salen los episodios de tus series y qué se estrena.
 *
 * - Mis series: los próximos episodios por día, con una tira de la semana para filtrar.
 * - Estrenos: películas de tu lista por estrenarse, lo reciente en tus plataformas y lo que
 *   llega a cines.
 */

import { HScroll } from '@/components/hscroll';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { card, glassFill, GlassButton } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { Image } from 'expo-image';
import { sharpImage } from '@/lib/tmdb';
import { useLang } from '@/i18n';
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
import { Touchable } from '@/components/touch';

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

type View3 = 'agenda' | 'month' | 'posters';

function MySeries() {
  const { loading, failed, episodes, watchedShows } = useCalendar();
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<View3>('agenda');

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
  const switcher = (
    <ViewSwitch
      value={view}
      onChange={(v) => {
        setView(v);
        setDay(null);
      }}
    />
  );
  if (view === 'month') {
    return (
      <View style={{ gap: Space.xl }}>
        {switcher}
        <MonthView episodes={episodes} />
      </View>
    );
  }
  if (view === 'posters') {
    return (
      <View style={{ gap: Space.xl }}>
        {switcher}
        <PosterView episodes={episodes} />
      </View>
    );
  }
  return (
    <View style={{ gap: Space.xl }}>
      {switcher}
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

/** Elegir cómo ver el calendario: agenda, mes o carátulas. */
function ViewSwitch({ value, onChange }: { value: View3; onChange: (v: View3) => void }) {
  const C = useColors();
  const opts: [View3, string, IconName][] = [
    ['agenda', 'Agenda', 'list'],
    ['month', 'Mes', 'calendar'],
    ['posters', 'Carátulas', 'grid'],
  ];
  return (
    <View style={{ flexDirection: 'row', borderRadius: 16, padding: 4, borderWidth: 1, ...glassFill(C), alignSelf: 'flex-start' }}>
      {opts.map(([k, label, icon]) => {
        const on = value === k;
        return (
          <Touchable
            key={k}
            haptic="select"
            onPress={() => onChange(k)}
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 40,
              paddingHorizontal: Space.md,
              borderRadius: 12,
              backgroundColor: on ? (C.mode === 'dark' ? 'rgba(255,255,255,0.14)' : '#fff') : 'transparent',
            }}>
            <View>
              <Icon name={icon} size={16} color={on ? C.accentInk : C.textMuted} strokeWidth={2.2} />
            </View>
            <T style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? C.text : C.textMuted }}>{label}</T>
          </Touchable>
        );
      })}
    </View>
  );
}

const WEEK_HEAD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Vista de mes: cada día con las carátulas de lo que sale; al tocar un día, su lista abajo. */
function MonthView({ episodes }: { episodes: CalendarEpisode[] }) {
  const C = useColors();
  const { lang } = useLang();
  const head = lang === 'es' ? WEEK_HEAD : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = todayISO();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(today);
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEpisode[]>();
    for (const e of episodes) m.set(e.airDate, [...(m.get(e.airDate) ?? []), e]);
    return m;
  }, [episodes]);
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, mo, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  const shift = (k: number) => {
    const d = new Date(y, mo - 1 + k, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const list = picked ? byDate.get(picked) ?? [] : [];
  return (
    <View style={{ gap: Space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="heading" style={{ textTransform: 'capitalize' }}>
          {MONTH_NAMES[mo - 1]} {y}
        </T>
        <View style={{ flexDirection: 'row', gap: Space.sm }}>
          <GlassButton icon="back" label="Mes anterior" onPress={() => shift(-1)} size={40} />
          <GlassButton icon="chevronRight" label="Mes siguiente" onPress={() => shift(1)} size={40} />
        </View>
      </View>
      <View style={{ borderRadius: 22, borderWidth: 1, ...glassFill(C), padding: Space.sm }}>
        <View style={{ flexDirection: 'row' }}>
          {head.map((d, i) => (
            <T key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.textMuted, paddingVertical: 6 }}>
              {d}
            </T>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            const eps = d ? byDate.get(d) ?? [] : [];
            const on = d === picked;
            const isToday = d === today;
            return (
              <Touchable
                key={i}
                disabled={!d}
                haptic="select"
                pressScale={0.94}
                onPress={() => d && setPicked(d)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 0.72,
                  padding: 3,
                }}>
                {d ? (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: on ? 2 : 0,
                      borderColor: C.accent,
                      backgroundColor: eps.length ? C.fill : 'transparent',
                    }}>
                    {eps[0]?.posterPath ? (
                      <Image
                        source={{ uri: sharpImage(eps[0].posterPath, 'poster', 60) ?? undefined }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : null}
                    {eps.length ? <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={StyleSheet.absoluteFill} /> : null}
                    <View style={{ padding: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View
                        style={
                          isToday
                            ? { backgroundColor: C.accent, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' }
                            : undefined
                        }>
                        <T style={{ fontSize: 12, fontWeight: '800', color: eps.length || isToday ? '#fff' : C.text, paddingHorizontal: isToday ? 3 : 0 }}>
                          {Number(d.slice(8))}
                        </T>
                      </View>
                      {eps.length > 1 ? <T style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>+{eps.length - 1}</T> : null}
                    </View>
                  </View>
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </View>
      {picked ? (
        <View style={{ gap: Space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space.sm }}>
            <T variant="heading">{dayLabel(picked)}</T>
            <T variant="small" muted>
              {longDate(picked)}
            </T>
          </View>
          {list.length ? (
            list.map((e) => <EpisodeRow key={`${e.key}:${e.season}:${e.episode}`} e={e} />)
          ) : (
            <T muted>Ninguna de tus series estrena episodio ese día.</T>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Vista de carátulas: cuadrícula de lo que sale, con el día en una etiqueta. */
function PosterView({ episodes }: { episodes: CalendarEpisode[] }) {
  const C = useColors();
  if (!episodes.length) return <T muted>Nada programado</T>;
  return (
    <Grid minWidth={130}>
      {episodes.slice(0, 120).map((e) => (
        <Link
          key={`${e.key}:${e.season}:${e.episode}`}
          href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }}
          asChild>
          <Touchable style={{ gap: 4 }}>
            <View>
              <Poster path={e.posterPath} title={e.title} width={130} />
              <View
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: 6,
                  paddingHorizontal: 8,
                  height: 24,
                  borderRadius: 12,
                  justifyContent: 'center',
                  backgroundColor: e.airDate === todayISO() ? C.accent : 'rgba(0,0,0,0.62)',
                }}>
                <T style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{dayLabel(e.airDate)}</T>
              </View>
            </View>
            <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>
              {e.title}
            </T>
            <T numberOfLines={1} variant="caption" muted>
              {formatEpisode(e.season, e.episode)}
            </T>
          </Touchable>
        </Link>
      ))}
    </Grid>
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
          <Touchable
            key={d}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${longDate(d)}${has ? ', con episodios' : ''}`}
            style={({ pressed }) => [styles.day, pressed && { opacity: 0.75 }]}>
            {on ? <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.md, backgroundColor: C.ink }]} /> : null}
            <T variant="caption" style={{ color: on ? C.onInk : C.textMuted, fontWeight: '600' }}>
              {d === today ? 'hoy' : shortDay(d)}
            </T>
            <T style={{ fontSize: 18, lineHeight: 22, fontWeight: '800', color: on ? C.onInk : C.text }}>
              {fromISO(d).getDate()}
            </T>
            <View style={[styles.dot, { backgroundColor: has ? (on ? C.onInk : C.accent) : 'transparent' }]} />
          </Touchable>
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
      <Touchable>
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
      </Touchable>
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
          <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
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
          </HScroll>
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
      <Touchable>
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
      </Touchable>
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
