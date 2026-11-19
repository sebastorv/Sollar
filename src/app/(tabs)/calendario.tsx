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
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

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
import { TypeFilter } from '@/components/type-filter';

type Tab = 'series' | 'estrenos';

export default function CalendarScreen() {
  const [tab, setTab] = useState<Tab>('series');
  return (
    <Screen>
      <T variant="title">Calendario</T>
      {/* Series o películas, con ícono, como el filtro de tipo del resto de la app. */}
      <TypeFilter
        value={tab === 'series' ? 'tv' : 'movie'}
        onChange={(v) => setTab(v === 'movie' ? 'estrenos' : 'series')}
        options={['tv', 'movie']}
      />
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
              {/\d/.test(dayLabel(g.date)) ? null : (
                <T variant="small" muted>
                  {longDate(g.date)}
                </T>
              )}
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
    <View style={{ flexDirection: 'row', borderRadius: 999, padding: 4, gap: 2, ...glassFill(C), alignSelf: 'flex-start' }}>
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
              height: 36,
              paddingHorizontal: on ? 14 : 11,
              borderRadius: 999,
              backgroundColor: on ? C.accentSoft : 'transparent',
            }}
            accessibilityLabel={label}>
            <View>
              <Icon name={icon} size={18} color={on ? C.accent : C.textMuted} strokeWidth={1.8} />
            </View>
            {on ? <T style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{label}</T> : null}
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
  const wide = useWindowDimensions().width >= 900;
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
  const monthName = lang === 'es' ? MONTH_NAMES[mo - 1] : new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long' });
  return (
    <View style={{ gap: Space.lg }}>
      {/* Encabezado limpio: mes y dos flechas finas. */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T raw variant="heading" style={{ flex: 1, textTransform: 'capitalize' }}>
          {monthName} {y}
        </T>
        <Touchable haptic="select" hitSlop={8} onPress={() => shift(-1)} accessibilityLabel="Mes anterior" style={{ padding: 8 }}>
          <Icon name="chevronLeft" size={22} color={C.text} strokeWidth={1.8} />
        </Touchable>
        <Touchable haptic="select" hitSlop={8} onPress={() => shift(1)} accessibilityLabel="Mes siguiente" style={{ padding: 8 }}>
          <Icon name="chevronRight" size={22} color={C.text} strokeWidth={1.8} />
        </Touchable>
      </View>
      <View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {head.map((d, i) => (
            <T key={i} raw style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '500', color: C.textMuted }}>
              {d}
            </T>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            const eps = d ? byDate.get(d) ?? [] : [];
            const on = d === picked;
            const isToday = d === today;
            const past = !!d && d < today;
            return (
              <Touchable
                key={i}
                disabled={!d}
                haptic="select"
                pressScale={0.94}
                onPress={() => d && setPicked(d)}
                style={{ width: `${100 / 7}%`, height: wide ? 118 : 56, padding: 2 }}>
                {d ? (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      alignItems: 'center',
                      paddingTop: 6,
                      gap: 4,
                      backgroundColor: on ? C.fill : 'transparent',
                    }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? C.accent : 'transparent',
                      }}>
                      <T raw style={{ fontSize: 15, fontWeight: isToday || on ? '600' : '400', color: isToday ? C.onAccent : past ? C.textMuted : C.text }}>
                        {Number(d.slice(8))}
                      </T>
                    </View>
                    {wide ? (
                      // En computador, las carátulas de lo que sale ese día, pequeñas y en fila.
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {eps.slice(0, 3).map((e) => (
                          <Image
                            key={`${e.key}:${e.episode}`}
                            source={{ uri: sharpImage(e.posterPath, 'poster', 34) ?? undefined }}
                            style={{ width: 30, height: 45, borderRadius: 6, backgroundColor: C.fill }}
                            contentFit="cover"
                          />
                        ))}
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {eps.slice(0, 3).map((e) => (
                          <View key={`${e.key}:${e.episode}`} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent }} />
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </View>
      {picked ? (
        <View style={{ gap: Space.sm }}>
          <T variant="heading">{dayLabel(picked)}</T>
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
  if (!episodes.length) return <T muted>Nada programado</T>;
  return (
    <Grid minWidth={120}>
      {episodes.slice(0, 120).map((e) => (
        <PosterCell key={`${e.key}:${e.season}:${e.episode}`} e={e} />
      ))}
    </Grid>
  );
}

/** Una carátula del calendario: el ancho lo pone la cuadrícula, y el texto no la estira. */
function PosterCell({ e, width = 120 }: { e: CalendarEpisode; width?: number }) {
  const C = useColors();
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Touchable style={{ width, gap: 8 }}>
        <View>
          <Poster path={e.posterPath} title={e.title} width={width} />
          <View style={dayTag}>
            {e.airDate === todayISO() ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} /> : null}
            <T numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#fff' }}>
              {dayLabel(e.airDate)}
            </T>
          </View>
        </View>
        <View>
          <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
            {e.title}
          </T>
          <T numberOfLines={1} variant="caption" muted>
            {formatEpisode(e.season, e.episode)}
          </T>
        </View>
      </Touchable>
    </Link>
  );
}

const dayTag = {
  position: 'absolute',
  left: 6,
  bottom: 6,
  maxWidth: '90%',
  paddingHorizontal: 8,
  height: 22,
  borderRadius: 11,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  backgroundColor: 'rgba(12,11,15,0.62)',
} as const;

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
            <T style={{ fontSize: 17, lineHeight: 22, fontWeight: '600', color: on ? C.onInk : C.text }}>
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
  const img = sharpImage(e.stillPath ?? e.posterPath, e.stillPath ? 'still' : 'poster', 128);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Touchable pressScale={0.98} style={styles.row}>
        <View style={styles.thumb}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <T numberOfLines={1} style={{ fontSize: 15, fontWeight: '600' }}>
            {e.title}
          </T>
          <T variant="small" muted numberOfLines={1}>
            {formatEpisode(e.season, e.episode)}
            {e.name ? ` · ${e.name}` : ''}
          </T>
          {badge ? (
            <T variant="caption" style={{ color: C.accentInk, fontWeight: '600' }}>
              {badge}
            </T>
          ) : null}
        </View>
        <T variant="caption" style={{ color: C.textMuted, fontWeight: '500' }}>
          {countdown(e.airDate)}
        </T>
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
                    subtitle={(r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null}
                    availability={availability[itemKey(type, r.id)]}
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
      flex: 1,
      backgroundColor: C.mode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      gap: 2,
      paddingVertical: Space.sm,
      borderRadius: Radius.md,
      overflow: 'hidden',
    },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      paddingVertical: 6,
    },
    thumb: { width: 112, aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: C.fill },
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
