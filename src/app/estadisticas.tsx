/**
 * Estadísticas y resumen del año: horas, rachas, meses, días favoritos, géneros, series más
 * vistas, mejores notas. "Siempre" muestra todo; cada año funciona como su propio resumen.
 */

import { HScroll } from '@/components/hscroll';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PopcornBag } from '@/components/brand';
import { card } from '@/components/glass';
import { Touchable } from '@/components/touch';
import { Chip, Empty, Poster, Screen, Section, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS,
  eventsOf,
  hours,
  longDuration,
  streaks,
  topBy,
  totalsOf,
} from '@/lib/activity';
import { todayISO } from '@/lib/dates';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

export default function StatsScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { items, get } = useLibrary();
  const all = useMemo(() => eventsOf(items), [items]);
  const years = useMemo(() => [...new Set(all.map((e) => e.day.slice(0, 4)))].sort().reverse(), [all]);
  const [period, setPeriod] = useState<string>('all');
  const events = useMemo(() => (period === 'all' ? all : all.filter((e) => e.day.startsWith(period))), [all, period]);
  const t = totalsOf(events);
  const st = useMemo(() => streaks(all, todayISO()), [all]);

  const monthly = useMemo(() => {
    const m = Array<number>(12).fill(0);
    if (period === 'all') {
      // Últimos 12 meses.
      const now = new Date();
      const labels: string[] = [];
      for (let k = 11; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        labels.push(MONTHS_SHORT[d.getMonth()]);
        m[11 - k] = events.filter((e) => e.day.startsWith(key)).reduce((a, e) => a + e.minutes, 0);
      }
      return { values: m, labels };
    }
    for (const e of events) m[Number(e.day.slice(5, 7)) - 1] += e.minutes;
    return { values: m, labels: MONTHS_SHORT };
  }, [events, period]);

  const weekdays = useMemo(() => {
    const w = Array<number>(7).fill(0);
    for (const e of events) w[new Date(e.day + 'T12:00:00').getDay()]++;
    return w;
  }, [events]);

  const genres = topBy(events, (e) => e.genres, 6, (e) => e.minutes);
  const topShows = topBy(events, (e) => (e.mediaType === 'tv' ? e.key : null), 6);
  const ratedMovies = useMemo(() => {
    const keys = new Set(events.filter((e) => e.mediaType === 'movie').map((e) => e.key));
    return [...keys]
      .map((k) => get(k)!)
      .filter((i) => i?.rating)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
  }, [events, get]);
  const ratingDist = useMemo(() => {
    const d = Array<number>(10).fill(0);
    for (const i of items) if (i.rating) d[i.rating - 1]++;
    return d;
  }, [items]);

  const bestMonth = monthly.values.indexOf(Math.max(...monthly.values));
  const bestDay = weekdays.indexOf(Math.max(...weekdays));

  return (
    <Screen>
      <View style={{ paddingTop: 52 }}>
        <T variant="title">Tus estadísticas</T>
      </View>
      <HScroll showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Space.sm }}>
        <Chip label="Siempre" selected={period === 'all'} onPress={() => setPeriod('all')} />
        {years.map((y) => (
          <Chip key={y} label={y} selected={period === y} onPress={() => setPeriod(y)} />
        ))}
      </HScroll>

      {events.length === 0 ? (
        <Empty title="Sin datos todavía" message="Marca episodios y películas, o importa tu historial desde Perfil." />
      ) : (
        <>
          {/* Portada del periodo: el número grande que se comparte. */}
          <View style={styles.hero}>
            <T style={styles.heroLabel}>{period === 'all' ? 'En total' : `Tu ${period} en Sollar`}</T>
            <T style={styles.heroBig}>{hours(t.minutes)}</T>
            <T style={styles.heroSub}>{longDuration(t.minutes)} frente a la pantalla</T>
            <View style={styles.heroRow}>
              <HeroStat value={t.episodes} label="episodios" />
              <HeroStat value={t.movies} label="películas" />
              <HeroStat value={t.titles} label="títulos" />
            </View>
            {period !== 'all' && monthly.values[bestMonth] > 0 ? (
              <T style={styles.heroSub}>
                Tu mes más activo fue {MONTHS[bestMonth]} y tu día favorito, el {dayName(bestDay)}.
              </T>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: Space.md }}>
            <Mini value={`${st.current}`} label={st.current === 1 ? 'día de racha' : 'días de racha'} />
            <Mini value={`${st.longest}`} label="tu racha más larga" />
          </View>

          <Section title={period === 'all' ? 'Últimos 12 meses' : 'Mes a mes'}>
            <Bars values={monthly.values} labels={monthly.labels} format={(v) => (v ? hours(v) : '')} />
          </Section>

          <Section title="Qué días ves más">
            <Bars values={weekdays} labels={WEEKDAYS} format={(v) => (v ? String(v) : '')} />
          </Section>

          {genres.length ? (
            <Section title="Tus géneros">
              <View style={styles.box}>
                {genres.map((g) => (
                  <HBar key={g.name} label={g.name} value={g.value} max={genres[0].value} text={hours(g.value)} />
                ))}
              </View>
            </Section>
          ) : null}

          {topShows.length ? (
            <Section title="Series que más viste">
              <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
                {topShows.map((s, i) => {
                  const it = get(s.name);
                  if (!it) return null;
                  return (
                    <Touchable
                      key={s.name}
                      style={{ width: 110, gap: 4 }}
                      onPress={() => router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(it.tmdbId) } })}>
                      <View>
                        <Poster path={it.posterPath} title={it.title} width={110} />
                        <View style={styles.rank}>
                          <T style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{i + 1}</T>
                        </View>
                      </View>
                      <T variant="label" numberOfLines={1}>
                        {it.title}
                      </T>
                      <T variant="caption" muted>
                        {s.value} episodios
                      </T>
                    </Touchable>
                  );
                })}
              </HScroll>
            </Section>
          ) : null}

          {ratedMovies.length ? (
            <Section title="Tus películas mejor calificadas">
              <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
                {ratedMovies.map((m) => (
                  <Touchable
                    key={m.key}
                    style={{ width: 110, gap: 4 }}
                    onPress={() => router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'movie', id: String(m.tmdbId) } })}>
                    <Poster path={m.posterPath} title={m.title} width={110} />
                    <T variant="label" numberOfLines={1}>
                      {m.title}
                    </T>
                    <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
                      Tu nota {m.rating}/10
                    </T>
                  </Touchable>
                ))}
              </HScroll>
            </Section>
          ) : null}

          {ratingDist.some(Boolean) ? (
            <Section title="Cómo calificas">
              <View style={styles.box}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 }}>
                  {ratingDist.map((v, i) => {
                    const max = Math.max(...ratingDist);
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                        <T variant="caption" muted style={{ fontSize: 10 }}>
                          {v || ''}
                        </T>
                        <View
                          style={{
                            width: '70%',
                            height: Math.max(4, (v / max) * 70),
                            borderRadius: 4,
                            backgroundColor: i >= 8 ? C.accent : C.accentLine,
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {ratingDist.map((_, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <PopcornBag filled={i >= 4} size={14} />
                      <T variant="caption" muted style={{ fontSize: 10 }}>
                        {i + 1}
                      </T>
                    </View>
                  ))}
                </View>
              </View>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );

  function HeroStat({ value, label }: { value: number; label: string }) {
    return (
      <View style={{ flex: 1 }}>
        <T style={styles.heroNum}>{value.toLocaleString('es-CO')}</T>
        <T style={styles.heroSmall}>{label}</T>
      </View>
    );
  }

  function Mini({ value, label }: { value: string; label: string }) {
    return (
      <View style={[styles.box, { flex: 1, gap: 2 }]}>
        <T style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: C.accentInk }}>{value}</T>
        <T variant="caption" muted>
          {label}
        </T>
      </View>
    );
  }

  function Bars({ values, labels, format }: { values: number[]; labels: string[]; format: (v: number) => string }) {
    const max = Math.max(1, ...values);
    const top = values.indexOf(max);
    return (
      <View style={[styles.box, { flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: 170 }]}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <T variant="caption" muted numberOfLines={1} style={{ fontSize: 10 }}>
              {i === top ? format(v) : ''}
            </T>
            <View
              style={{
                width: '72%',
                height: Math.max(4, (v / max) * 110),
                borderRadius: 5,
                backgroundColor: i === top ? C.ink : C.accentLine,
              }}
            />
            <T variant="caption" muted style={{ fontSize: 10 }}>
              {labels[i]}
            </T>
          </View>
        ))}
      </View>
    );
  }

  function HBar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
    return (
      <View style={{ gap: 4, paddingVertical: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="small" style={{ fontWeight: '600' }}>
            {label}
          </T>
          <T variant="small" muted>
            {text}
          </T>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.fill, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round((value / max) * 100)}%`, height: '100%', backgroundColor: C.ink }} />
        </View>
      </View>
    );
  }
}

function dayName(i: number) {
  return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][i];
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    // Portada sobria: tinta sólida, el número grande manda.
    hero: { borderRadius: Radius.lg, overflow: 'hidden', padding: Space.xl, gap: Space.xs, backgroundColor: C.ink },
    heroLabel: { color: C.onInk, opacity: 0.7, fontWeight: '700', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
    heroBig: { color: C.onInk, fontSize: 60, lineHeight: 66, fontWeight: '900', letterSpacing: -2.4 },
    heroSub: { color: C.onInk, opacity: 0.75, fontSize: 14, lineHeight: 20 },
    heroRow: { flexDirection: 'row', marginVertical: Space.md },
    heroNum: { color: C.onInk, fontSize: 22, lineHeight: 26, fontWeight: '800' },
    heroSmall: { color: C.onInk, opacity: 0.65, fontSize: 12 },
    box: { ...card(C), borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm },
    rank: {
      position: 'absolute',
      left: 6,
      top: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
