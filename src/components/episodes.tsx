/**
 * Episodios de una serie, como Trakt y Bingebase:
 *
 * - UpNext: el panel "Lo que sigue" con el episodio siguiente sobre su imagen, tu avance (vistos,
 *   porcentaje, tiempo exacto que falta), una cuadrícula con una casilla por temporada y tu historial.
 * - SeasonsBlock: temporadas con menú "Temporada 2 de 5", marcar la temporada, orden y carátulas;
 *   debajo, los episodios en fila horizontal (imagen, duración, ✓ sobre el borde, título y T·E).
 * - EpisodePanel: en computador, el episodio se abre en un panel a la derecha sin salir de la ficha.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tr, useL, useLang } from '@/i18n';
import { Radius, Space, type Colors } from '@/constants/theme';
import { itemKey, seasonsFromTv } from '@/lib/library-item';
import { formatDuration, nextEpisode, totalEpisodes } from '@/lib/progress';
import { getSeason, isDemo, sharpImage } from '@/lib/tmdb';
import { episodeKey, type LibraryItem, type TmdbEpisode, type TmdbSeason, type TmdbTv } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

import { glassFill, GlassButton } from './glass';
import { HScroll } from './hscroll';
import { Icon, type IconName } from './icons';
import { Rating, Reactions } from './rating';
import { anchorOf, BubbleMenu, type Anchor } from './sheet';
import { Touchable } from './touch';
import { Loading, T } from './ui';

const native = false;
const MON_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20 mar 2004" o "20 Mar 2004", según el idioma. */
export function useDate() {
  const { lang } = useLang();
  return (iso: string | null | undefined) => {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${(lang === 'es' ? MON_ES : MON_EN)[m - 1]} ${y}`;
  };
}

/** "T1 · E3" en español, "S1 · E3" en inglés. */
export function useEpLabel() {
  const L = useL();
  return (s: number, e: number) => L(`T${s} · E${e}`, `S${s} · E${e}`);
}

// --- Tiempo exacto que falta ---

export type Remaining = { minutes: number; aired: number; upcoming: number; bySeason: Record<number, { aired: number; total: number }> };

/** Suma la duración real de cada episodio ya emitido que te falta ver. */
export function useRemaining(item: LibraryItem | undefined, runtime: number): Remaining | null {
  const [exact, setExact] = useState<Remaining | null>(null);
  const watchedJson = item ? JSON.stringify(item.watchedEpisodes) : '';
  useEffect(() => {
    if (!item) return;
    let off = false;
    const nums = item.seasons.filter((x) => x.seasonNumber > 0 && x.episodeCount > 0).map((x) => x.seasonNumber).slice(0, 60);
    Promise.all(nums.map((n) => getSeason(item.tmdbId, n).catch(() => null))).then((all) => {
      if (off) return;
      const today = new Date().toISOString().slice(0, 10);
      let minutes = 0;
      let aired = 0;
      let upcoming = 0;
      const bySeason: Remaining['bySeason'] = {};
      for (const season of all) {
        if (!season) continue;
        const row = { aired: 0, total: season.episodes.length };
        for (const e of season.episodes) {
          const isAired = !!e.air_date && e.air_date <= today;
          if (isAired) row.aired++;
          if (item.watchedEpisodes[episodeKey(season.season_number, e.episode_number)]) continue;
          if (isAired) {
            aired++;
            minutes += e.runtime || runtime;
          } else upcoming++;
        }
        bySeason[season.season_number] = row;
      }
      setExact({ minutes, aired, upcoming, bySeason });
    });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.tmdbId, watchedJson]);
  return exact;
}

/** Avance compacto para la portada: barra por temporada, vistos y tiempo exacto. */
export function ProgressSummary({ item, runtime }: { item: LibraryItem; runtime: number }) {
  const C = useColors();
  const L = useL();
  const exact = useRemaining(item, runtime);
  const seasons = item.seasons.filter((s) => s.seasonNumber > 0 && s.episodeCount > 0);
  const total = totalEpisodes(seasons);
  if (!total) return null;
  const seenIn = (n: number) => Object.keys(item.watchedEpisodes).filter((k) => k.startsWith(`${n}:`)).length;
  const seen = seasons.reduce((a, s) => a + Math.min(seenIn(s.seasonNumber), s.episodeCount), 0);
  const pct = Math.round((seen / total) * 100);
  return (
    <View style={{ gap: Space.sm }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
        {seasons.map((s) => {
          const f = Math.min(seenIn(s.seasonNumber), s.episodeCount) / s.episodeCount;
          return (
            <View key={s.seasonNumber} style={{ flex: s.episodeCount, borderRadius: 4, overflow: 'hidden', backgroundColor: C.fill }}>
              <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.round(f * 100)}%`, height: '100%' }} />
            </View>
          );
        })}
      </View>
      <T raw style={{ fontSize: 15, color: C.textMuted }}>
        <T raw style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
          {seen}
        </T>
        {L(` de ${total} vistos · ${pct} %`, ` of ${total} watched · ${pct}%`)}
      </T>
      {exact ? (
        exact.aired > 0 ? (
          <T raw style={{ fontSize: 15, color: C.text }}>
            {L('Te faltan ', '')}
            <T raw style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>
              {L(formatDuration(exact.minutes), formatDuration(exact.minutes))}
            </T>
            {L(
              ` para terminarla (${exact.aired} ${exact.aired === 1 ? 'episodio' : 'episodios'})${exact.upcoming ? `, y ${exact.upcoming} por estrenarse` : ''}.`,
              ` left to finish it (${exact.aired} ${exact.aired === 1 ? 'episode' : 'episodes'})${exact.upcoming ? `, plus ${exact.upcoming} still to air` : ''}.`,
            )}
          </T>
        ) : (
          <T raw style={{ fontSize: 15, color: C.text, fontWeight: '600' }}>
            {L(
              `¡Estás al día!${exact.upcoming ? ` Faltan ${exact.upcoming} episodios por estrenarse.` : ''}`,
              `You're all caught up!${exact.upcoming ? ` ${exact.upcoming} episodes still to air.` : ''}`,
            )}
          </T>
        )
      ) : null}
    </View>
  );
}

// --- Lo que sigue (como Trakt) ---

export function UpNext({
  tv,
  item,
  wide,
  onOpen,
  onNeedItem,
}: {
  tv: TmdbTv;
  item: LibraryItem;
  wide: boolean;
  onOpen: (t: { season: number; episode: number }) => void;
  onNeedItem: () => void;
}) {
  const L = useL();
  const date = useDate();
  const lib = useLibrary();
  const next = nextEpisode(item);
  const runtime = tv.episode_run_time.find((x) => x > 0) ?? 0;
  const exact = useRemaining(item, runtime);
  const [season, setSeason] = useState<TmdbSeason | null>(null);
  useEffect(() => {
    if (!next) return;
    let off = false;
    getSeason(tv.id, next.season)
      .then((s) => !off && setSeason(s))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [tv.id, next?.season]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10);
  const ep = next && season?.season_number === next.season ? season.episodes.find((e) => e.episode_number === next.episode) : null;
  const aired = !!ep?.air_date && ep.air_date <= today;
  const seasons = item.seasons.filter((s) => s.seasonNumber > 0 && s.episodeCount > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  const total = totalEpisodes(seasons);
  const seenIn = (n: number) => Object.keys(item.watchedEpisodes).filter((k) => k.startsWith(`${n}:`)).length;
  const seen = seasons.reduce((a, s) => a + Math.min(seenIn(s.seasonNumber), s.episodeCount), 0);
  const pct = total ? Math.round((seen / total) * 100) : 0;
  const done = seasons.filter((s) => seenIn(s.seasonNumber) >= s.episodeCount);
  const current = next ? seasons.find((s) => s.seasonNumber === next.season) : null;
  const leftInSeason = ep && season ? season.episodes.filter((e) => e.episode_number >= ep.episode_number && e.air_date && e.air_date <= today).length : 0;

  // Historial: cuándo la agregaste, primer y último episodio visto.
  const plays = Object.entries(item.watchedEpisodes).sort((a, b) => a[1].localeCompare(b[1]));
  const first = plays[0];
  const last = plays[plays.length - 1];
  const lastLabel = last ? (() => {
    const [s, e] = last[0].split(':').map(Number);
    return L(`T${s} · E${e}`, `S${s} · E${e}`);
  })() : null;

  const still = sharpImage(ep?.still_path ?? tv.backdrop_path, 'backdrop', wide ? 1280 : 780);
  const doneRange =
    done.length === 0
      ? null
      : done.length === 1
        ? L(`Temporada ${done[0].seasonNumber} completa`, `Season ${done[0].seasonNumber} complete`)
        : done.every((s, i) => i === 0 || s.seasonNumber === done[i - 1].seasonNumber + 1)
          ? L(`Temporadas ${done[0].seasonNumber}–${done[done.length - 1].seasonNumber} completas`, `Seasons ${done[0].seasonNumber}–${done[done.length - 1].seasonNumber} complete`)
          : L(`${done.length} temporadas completas`, `${done.length} seasons complete`);
  const toGo = seasons.length - done.length - (current && !done.includes(current) ? 1 : 0);

  const W = '#FFFFFF';
  const dim = 'rgba(255,255,255,0.72)';
  const label = { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.4, color: dim };

  // Columnas: en computador, tres lado a lado; en celular, avance y temporadas lado a lado y el
  // historial debajo.
  const col = (title: string, body: React.ReactNode, first?: boolean, last?: boolean) => (
    <View
      style={[
        { flex: wide || !last ? 1 : undefined, gap: 8, paddingVertical: Space.lg, paddingHorizontal: wide ? Space.xl : 0, minWidth: 0 },
        wide && !first && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.14)' },
        !wide && last && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
        first && wide && { paddingLeft: 0 },
      ]}>
      <T raw style={label}>
        {title}
      </T>
      {body}
    </View>
  );

  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: '#17161C', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.18)' }}>
      {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : null}
      <LinearGradient
        colors={['rgba(12,11,15,0.55)', 'rgba(12,11,15,0.86)', 'rgba(12,11,15,0.97)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(12,11,15,0.85)', 'rgba(12,11,15,0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ padding: wide ? Space.xxl : Space.xl, paddingBottom: Space.md, gap: Space.sm }}>
        {/* Rótulo, título del episodio y datos. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Icon name="sparkle" size={14} color="#FFB061" filled />
          <T raw style={[label, { color: '#FFB061' }]}>
            {next ? L('LO QUE SIGUE', 'UP NEXT') : L('AL DÍA', 'ALL CAUGHT UP')}
          </T>
          {next ? (
            <T raw style={label}>
              {L(`· TEMPORADA ${next.season} · EPISODIO ${next.episode}`, `· SEASON ${next.season} · EPISODE ${next.episode}`)}
            </T>
          ) : null}
        </View>
        {next ? (
          <Touchable haptic="select" pressScale={0.99} onPress={() => onOpen(next)}>
            <T raw numberOfLines={2} style={{ fontSize: wide ? 40 : 28, lineHeight: wide ? 46 : 33, fontWeight: '800', letterSpacing: -1, color: W }}>
              {ep?.name ?? ' '}
            </T>
          </Touchable>
        ) : (
          <T raw style={{ fontSize: wide ? 34 : 26, fontWeight: '800', letterSpacing: -0.8, color: W }}>
            {L('Viste todo lo que ha salido', "You've seen everything that's out")}
          </T>
        )}
        {ep ? (
          <T raw style={{ fontSize: 15, color: dim }}>
            {[
              ep.air_date && !isDemo ? (aired ? L(`Salió el ${date(ep.air_date)}`, `Aired ${date(ep.air_date)}`) : L(`Sale el ${date(ep.air_date)}`, `Airs ${date(ep.air_date)}`)) : null,
              ep.runtime ? `${ep.runtime} min` : null,
              leftInSeason > 1 ? L(`faltan ${leftInSeason} en la temporada`, `${leftInSeason} episodes left in the season`) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
        ) : null}
        {next && aired ? (
          <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm, flexWrap: 'wrap' }}>
            <Touchable
              haptic="success"
              pressScale={0.95}
              onPress={() => {
                onNeedItem();
                lib.setEpisodes(item.key, [next], true);
              }}
              style={[S.pillBtn, { backgroundColor: '#fff' }]}>
              <Icon name="check" size={18} color="#111" strokeWidth={2.6} />
              <T raw style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>
                {L('Marcar como visto', 'Mark as watched')}
              </T>
            </Touchable>
            <Touchable haptic="light" pressScale={0.95} onPress={() => onOpen(next)} style={[S.pillBtn, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <Icon name="info" size={18} color="#fff" strokeWidth={2.2} />
              <T raw style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                {L('Detalles', 'Details')}
              </T>
            </Touchable>
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: Space.lg }} />

        <View style={{ flexDirection: wide ? 'row' : 'column' }}>
          <View style={{ flexDirection: 'row', flex: wide ? 2 : undefined, gap: wide ? 0 : Space.lg }}>
          {col(
            L('TU AVANCE', 'YOUR PROGRESS'),
            <>
              <T raw style={{ fontSize: wide ? 40 : 30, fontWeight: '800', letterSpacing: -1, color: W }}>
                {seen}
                <T raw style={{ fontSize: wide ? 40 : 30, fontWeight: '800', color: 'rgba(255,255,255,0.5)' }}>
                  /{total}
                </T>
              </T>
              <T raw style={{ fontSize: 15, color: dim }}>
                <T raw style={{ fontSize: 15, fontWeight: '800', color: W }}>
                  {pct}%
                </T>
                {' · '}
                {L(`faltan ${total - seen}`, `${total - seen} left`)}
                {exact && exact.minutes ? ` · ~${formatDuration(exact.minutes)}` : ''}
              </T>
            </>,
            true,
          )}
          {col(
            L('TEMPORADAS', 'SEASONS'),
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, maxWidth: 14 * 22 }}>
                {seasons.map((s) => {
                  const n = seenIn(s.seasonNumber);
                  const full = n >= s.episodeCount;
                  const isCur = current?.seasonNumber === s.seasonNumber && !full;
                  return (
                    <View
                      key={s.seasonNumber}
                      accessibilityLabel={L(`Temporada ${s.seasonNumber}: ${n} de ${s.episodeCount}`, `Season ${s.seasonNumber}: ${n} of ${s.episodeCount}`)}
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 5,
                        overflow: 'hidden',
                        backgroundColor: full ? '#3DD68C' : 'rgba(255,255,255,0.12)',
                        borderWidth: isCur ? 2 : 0,
                        borderColor: '#FFB061',
                      }}>
                      {isCur ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((n / s.episodeCount) * 100)}%`, backgroundColor: '#FF8A3D' }} /> : null}
                    </View>
                  );
                })}
              </View>
              <T raw style={{ fontSize: 15, color: dim }}>
                {[
                  doneRange,
                  current && seenIn(current.seasonNumber) < current.episodeCount
                    ? L(`T${current.seasonNumber} ${seenIn(current.seasonNumber)}/${current.episodeCount}`, `S${current.seasonNumber} ${seenIn(current.seasonNumber)}/${current.episodeCount}`)
                    : null,
                  toGo > 0 ? L(`faltan ${toGo}`, `${toGo} to go`) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </>,
          )}
          </View>
          {col(
            L('HISTORIAL', 'HISTORY'),
            <View style={{ gap: 4 }}>
              <T raw style={{ fontSize: 15, color: dim }}>
                {L('Agregada el ', 'Added ')}
                <T raw style={{ fontSize: 15, fontWeight: '700', color: W }}>
                  {date(item.addedAt)}
                </T>
              </T>
              {first ? (
                <T raw style={{ fontSize: 15, color: dim }}>
                  {L('Primer episodio visto el ', 'First watched ')}
                  <T raw style={{ fontSize: 15, fontWeight: '700', color: W }}>
                    {date(first[1])}
                  </T>
                </T>
              ) : null}
              {last && lastLabel ? (
                <T raw style={{ fontSize: 15, color: dim }}>
                  {L('Último: ', 'Last watched ')}
                  <T raw style={{ fontSize: 15, fontWeight: '700', color: W }}>
                    {lastLabel}
                  </T>
                  {L(' el ', ' on ')}
                  <T raw style={{ fontSize: 15, fontWeight: '700', color: W }}>
                    {date(last[1])}
                  </T>
                  {' · '}
                  {L(`${plays.length} vistos`, `${plays.length} plays`)}
                </T>
              ) : null}
            </View>,
            false,
            true,
          )}
        </View>
      </View>
    </View>
  );
}

// --- Temporadas y episodios ---

export function SeasonsBlock({
  tv,
  item,
  wide,
  onNeedItem,
  onOpen,
}: {
  tv: TmdbTv;
  item: LibraryItem | undefined;
  wide: boolean;
  onNeedItem: () => void;
  onOpen: (t: { season: number; episode: number }) => void;
}) {
  const C = useColors();
  const L = useL();
  const date = useDate();
  const epLabel = useEpLabel();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const seasons = useMemo(() => seasonsFromTv(tv), [tv]);
  const next = item ? nextEpisode(item) : null;
  const [season, setSeason] = useState<number>(next?.season ?? seasons[0]?.seasonNumber ?? 1);
  const [data, setData] = useState<TmdbSeason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newest, setNewest] = useState(false);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [epMenu, setEpMenu] = useState<{ anchor: Anchor; ep: TmdbEpisode } | null>(null);
  const shelf = useRef<ScrollViewInstance>(null);
  const seasonShelf = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    let off = false;
    setData(null);
    setError(null);
    getSeason(tv.id, season)
      .then((s) => !off && setData(s))
      .catch((e: Error) => !off && setError(e.message));
    return () => {
      off = true;
    };
  }, [tv.id, season]);

  if (!seasons.length) return <T muted>Aún no hay episodios anunciados.</T>;

  const today = new Date().toISOString().slice(0, 10);
  const key = itemKey('tv', tv.id);
  const seen = (s: number, e: number) => Boolean(item?.watchedEpisodes[episodeKey(s, e)]);
  const aired = (data?.episodes ?? []).filter((e) => e.air_date && e.air_date <= today);
  const allSeen = aired.length > 0 && aired.every((e) => seen(season, e.episode_number));
  const cardW = wide ? 300 : 248;
  const list = newest ? [...(data?.episodes ?? [])].reverse() : data?.episodes ?? [];

  function toggle(ep: TmdbEpisode) {
    onNeedItem();
    lib.setEpisodes(key, [{ season, episode: ep.episode_number }], !seen(season, ep.episode_number));
  }
  function upTo(ep: TmdbEpisode) {
    onNeedItem();
    lib.setEpisodes(
      key,
      (data?.episodes ?? [])
        .filter((e) => e.episode_number <= ep.episode_number && e.air_date && e.air_date <= today)
        .map((e) => ({ season, episode: e.episode_number })),
      true,
    );
  }
  function pick(n: number) {
    setSeason(n);
    shelf.current?.scrollTo({ x: 0, animated: false });
  }

  return (
    <View style={{ gap: Space.lg }}>
      {/* Encabezado: Temporadas y menú de temporada; debajo (o al lado) marcar y orden. */}
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: Space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, flex: wide ? 1 : undefined }}>
          <T variant="heading" style={{ marginRight: 'auto' }}>Temporadas</T>
          <Touchable
            haptic="select"
            pressScale={0.96}
            onPress={async (e) => setMenu(await anchorOf(e, { x: 0, y: 0, width: 0, height: 0 }))}
            accessibilityRole="button"
            style={styles.dropdown}>
            <T raw style={{ fontSize: 15, fontWeight: '700' }}>
              {L(`Temporada ${season} de ${seasons.length}`, `Season ${season} of ${seasons.length}`)}
            </T>
            <Icon name="chevronDown" size={16} color={C.text} strokeWidth={2.4} />
          </Touchable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md }}>
          <Touchable
            haptic="medium"
            disabled={aired.length === 0}
            onPress={() => {
              onNeedItem();
              lib.setEpisodes(key, aired.map((e) => ({ season, episode: e.episode_number })), !allSeen);
            }}
            style={[styles.textBtn, { opacity: aired.length ? 1 : 0.4, flexShrink: 1 }]}>
            <Icon name={allSeen ? 'close' : 'check'} size={17} color={C.text} strokeWidth={2.4} />
            <T raw style={{ fontSize: 15, fontWeight: '700' }}>
              {allSeen ? L('Desmarcar', 'Unmark season') : wide ? L('Marcar temporada', 'Mark season watched') : L('Marcar temporada', 'Mark season')}
            </T>
          </Touchable>
          <View style={styles.segment}>
            {[false, true].map((n) => (
              <Touchable
                key={String(n)}
                haptic="select"
                onPress={() => setNewest(n)}
                accessibilityState={{ selected: newest === n }}
                style={[styles.segBtn, newest === n && styles.segOn]}>
                <T raw style={{ fontSize: 14, fontWeight: newest === n ? '700' : '500', color: newest === n ? C.text : C.textMuted }}>
                  {n ? L('Recientes', 'Newest') : L('Primeros', 'Oldest')}
                </T>
              </Touchable>
            ))}
          </View>
        </View>
      </View>

      {/* Carátulas de las temporadas. */}
      {seasons.length > 1 ? (
        <HScroll innerRef={seasonShelf} contentContainerStyle={{ gap: Space.md, paddingVertical: 4 }}>
          {seasons.map((s) => {
            const on = s.seasonNumber === season;
            const count = item ? Array.from({ length: s.episodeCount }, (_, i) => i + 1).filter((e) => seen(s.seasonNumber, e)).length : 0;
            const stub = tv.seasons.find((x) => x.season_number === s.seasonNumber);
            const art = sharpImage(stub?.poster_path ?? tv.poster_path, 'poster', 130);
            const done = count >= s.episodeCount && count > 0;
            return (
              <Touchable
                key={s.seasonNumber}
                haptic="select"
                pressScale={0.95}
                onPress={() => pick(s.seasonNumber)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ width: wide ? 132 : 108, gap: 6 }}>
                <View style={[styles.seasonArt, on && { borderColor: C.accent, borderWidth: 3 }]}>
                  {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                  {done ? (
                    <View style={styles.doneBadge}>
                      <Icon name="check" size={13} color="#fff" strokeWidth={3} />
                    </View>
                  ) : null}
                  {count > 0 && !done ? (
                    <View style={styles.progressTrack}>
                      <View style={{ height: '100%', width: `${Math.round((count / s.episodeCount) * 100)}%`, backgroundColor: C.accent }} />
                    </View>
                  ) : null}
                </View>
                <T raw numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? C.text : C.textMuted }}>
                  {L(`Temporada ${s.seasonNumber}`, `Season ${s.seasonNumber}`)}
                  <T raw style={{ fontSize: 14, color: C.textMuted, fontWeight: '500' }}>
                    {stub?.air_date ? ` ${stub.air_date.slice(0, 4)}` : ''}
                  </T>
                </T>
                <T raw variant="caption" muted>
                  {count}/{s.episodeCount}
                  {L(' episodios', ' episodes')}
                </T>
              </Touchable>
            );
          })}
        </HScroll>
      ) : null}

      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      {!data && !error ? <Loading /> : null}

      {/* Episodios: tarjetas horizontales como Bingebase. */}
      <HScroll innerRef={shelf} contentContainerStyle={{ gap: Space.lg, paddingBottom: 4 }}>
        {list.map((ep) => {
          const isSeen = seen(season, ep.episode_number);
          const upcoming = !ep.air_date || ep.air_date > today;
          const still = sharpImage(ep.still_path, 'still', cardW);
          const tag =
            ep.episode_type === 'finale'
              ? L('FINAL', 'FINALE')
              : ep.episode_number === 1
                ? L('ESTRENO', 'PREMIERE')
                : ep.episode_type === 'mid_season'
                  ? L('MITAD', 'MIDSEASON')
                  : null;
          return (
            <Touchable
              key={ep.id}
              haptic="select"
              pressScale={0.97}
              onPress={() => onOpen({ season, episode: ep.episode_number })}
              accessibilityRole="button"
              accessibilityLabel={`${epLabel(season, ep.episode_number)}, ${ep.name}`}
              style={{ width: cardW, gap: 16 }}>
              <View>
                <View style={[styles.epStill, upcoming && { opacity: 0.55 }]}>
                  {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Icon name="tv" size={32} color={C.textFaint} />
                    </View>
                  )}
                  {tag ? (
                    <View style={[styles.chip, { top: 8, left: 8 }]}>
                      <T raw style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>
                        {tag}
                      </T>
                    </View>
                  ) : null}
                  {ep.runtime ? (
                    <View style={[styles.chip, { left: 8, bottom: 8 }]}>
                      <T raw style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
                        {ep.runtime}m
                      </T>
                    </View>
                  ) : null}
                </View>
                <Touchable
                  haptic="select"
                  pressScale={0.85}
                  hitSlop={6}
                  accessibilityLabel={L('Opciones del episodio', 'Episode options')}
                  onPress={async (e) => setEpMenu({ anchor: await anchorOf(e, { x: 0, y: 0, width: 0, height: 0 }), ep })}
                  style={styles.epMore}>
                  <Icon name="moreV" size={16} color="#fff" />
                </Touchable>
                {/* ✓ sobre el borde de abajo; los que no han salido muestran la fecha. */}
                <View style={S.checkWrap} pointerEvents="box-none">
                  {upcoming ? (
                    <View style={[S.checkPill, { backgroundColor: C.mode === 'dark' ? '#3A3846' : 'rgba(22,20,28,0.92)', paddingHorizontal: 10, width: undefined }]}>
                      <T raw style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                        {ep.air_date ? date(ep.air_date) : L('Por anunciar', 'TBA')}
                      </T>
                    </View>
                  ) : (
                    <Touchable
                      haptic={isSeen ? 'light' : 'success'}
                      pressScale={0.82}
                      hitSlop={8}
                      onPress={() => toggle(ep)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSeen }}
                      accessibilityLabel={isSeen ? L('Desmarcar', 'Unmark') : L('Marcar como visto', 'Mark as watched')}
                      style={[S.checkPill, { backgroundColor: isSeen ? C.accent : C.mode === 'dark' ? '#3A3846' : 'rgba(22,20,28,0.92)' }]}>
                      <Icon name={isSeen ? 'checks' : 'check'} size={17} color="#fff" strokeWidth={2.6} />
                    </Touchable>
                  )}
                </View>
              </View>
              <View style={{ gap: 2 }}>
                <T raw numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
                  {ep.name}
                </T>
                <T raw variant="caption" muted numberOfLines={1}>
                  {[epLabel(season, ep.episode_number), !upcoming && !isDemo && ep.air_date ? date(ep.air_date) : null, ep.vote_average ? `★ ${ep.vote_average.toFixed(1)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
              </View>
            </Touchable>
          );
        })}
      </HScroll>

      <BubbleMenu
        anchor={menu}
        title={L('Temporadas', 'Seasons')}
        onClose={() => setMenu(null)}
        items={seasons.map((s) => {
          const count = item ? Array.from({ length: s.episodeCount }, (_, i) => i + 1).filter((e) => seen(s.seasonNumber, e)).length : 0;
          return {
            label: L(`Temporada ${s.seasonNumber} · ${count}/${s.episodeCount}`, `Season ${s.seasonNumber} · ${count}/${s.episodeCount}`),
            on: s.seasonNumber === season,
            onPress: () => {
              pick(s.seasonNumber);
              seasonShelf.current?.scrollTo({ x: Math.max(0, seasons.indexOf(s) - 1) * ((wide ? 132 : 108) + Space.md), animated: true });
            },
          };
        })}
      />
      <BubbleMenu
        anchor={epMenu?.anchor ?? null}
        title={epMenu ? epLabel(season, epMenu.ep.episode_number) : undefined}
        onClose={() => setEpMenu(null)}
        items={
          epMenu
            ? [
                ...(epMenu.ep.air_date && epMenu.ep.air_date <= today
                  ? [
                      {
                        label: seen(season, epMenu.ep.episode_number) ? L('Desmarcar', 'Unmark') : L('Marcar como visto', 'Mark as watched'),
                        icon: 'check' as IconName,
                        onPress: () => toggle(epMenu.ep),
                      },
                      ...(epMenu.ep.episode_number > 1
                        ? [{ label: L('Visto hasta aquí', 'Watched up to here'), icon: 'checks' as IconName, onPress: () => upTo(epMenu.ep) }]
                        : []),
                    ]
                  : []),
                { label: L('Ver detalles', 'View details'), icon: 'info' as IconName, onPress: () => onOpen({ season, episode: epMenu.ep.episode_number }) },
              ]
            : []
        }
      />
    </View>
  );
}

// --- Panel lateral del episodio (computador) ---

export function EpisodePanel({
  tv,
  target,
  item,
  onClose,
  onNeedItem,
  onNavigate,
}: {
  tv: TmdbTv;
  target: { season: number; episode: number } | null;
  item: LibraryItem | undefined;
  onClose: () => void;
  onNeedItem: () => void;
  onNavigate: (t: { season: number; episode: number }) => void;
}) {
  const C = useColors();
  const L = useL();
  const date = useDate();
  const epLabel = useEpLabel();
  const lib = useLibrary();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [data, setData] = useState<TmdbSeason | null>(null);
  const [shown, setShown] = useState<typeof target>(target);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (target) {
      setShown(target);
      Animated.spring(x, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 4 }).start();
    } else if (shown) {
      Animated.timing(x, { toValue: 0, duration: 180, useNativeDriver: native }).start(() => setShown(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (!shown) return;
    let off = false;
    if (data?.season_number !== shown.season) setData(null);
    getSeason(tv.id, shown.season)
      .then((s) => !off && setData(s))
      .catch(() => {});
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv.id, shown?.season]);

  if (!shown) return null;
  const W = Math.min(500, Math.max(380, width * 0.36));
  const ep = data?.season_number === shown.season ? data.episodes.find((e) => e.episode_number === shown.episode) : null;
  const key = itemKey('tv', tv.id);
  const ek = episodeKey(shown.season, shown.episode);
  const seen = Boolean(item?.watchedEpisodes[ek]);
  const aired = !!ep?.air_date && ep.air_date <= new Date().toISOString().slice(0, 10);
  const still = ep ? sharpImage(ep.still_path ?? tv.backdrop_path, 'still', W) : null;
  const directors = (ep?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);

  const all = tv.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);
  const total = data?.episodes.length ?? 0;
  const prevSeason = all.filter((s) => s.season_number < shown.season).pop();
  const nextSeason = all.find((s) => s.season_number > shown.season);
  const prev = shown.episode > 1 ? { season: shown.season, episode: shown.episode - 1 } : prevSeason ? { season: prevSeason.season_number, episode: prevSeason.episode_count } : null;
  const next = shown.episode < total ? { season: shown.season, episode: shown.episode + 1 } : nextSeason ? { season: nextSeason.season_number, episode: 1 } : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tr('Cerrar')}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)', opacity: x }]} />
      </Pressable>
      <Animated.View
        style={{
          position: 'absolute',
          top: Space.md,
          right: Space.md,
          bottom: Space.md,
          width: W,
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: C.mode === 'light' ? 'rgba(250,250,252,0.86)' : 'rgba(24,23,30,0.88)',
          ...({ backdropFilter: 'blur(36px) saturate(180%)', WebkitBackdropFilter: 'blur(36px) saturate(180%)', boxShadow: '0 20px 60px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.25)' } as object),
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [W + 40, 0] }) }],
        }}>
        <ScrollView contentContainerStyle={{ padding: Space.xl, paddingTop: Math.max(insets.top, Space.xl), gap: Space.lg, minHeight: height - Space.md * 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Space.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T raw numberOfLines={1} style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
                {tv.name}
              </T>
              <T raw numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: C.accentInk }}>
                {epLabel(shown.season, shown.episode)}
                {ep ? ` · ${ep.name}` : ''}
              </T>
            </View>
            <GlassButton icon="close" label="Cerrar" onPress={onClose} size={40} />
          </View>

          {!ep ? (
            <Loading />
          ) : (
            <>
              <View>
                <View style={{ aspectRatio: 16 / 9, borderRadius: 22, overflow: 'hidden', backgroundColor: C.fill }}>
                  {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                </View>
                {seen ? (
                  <View style={S.checkWrap}>
                    <View style={[S.checkPill, { backgroundColor: C.accent, width: undefined, paddingHorizontal: 12, flexDirection: 'row', gap: 6 }]}>
                      <Icon name="checks" size={15} color="#fff" strokeWidth={2.6} />
                      <T raw style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>
                        {L('VISTO', 'WATCHED')}
                      </T>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Space.sm }}>
                <Touchable haptic="select" disabled={!prev} onPress={() => prev && onNavigate(prev)} hitSlop={10} style={{ opacity: prev ? 1 : 0.3, padding: 6 }} accessibilityLabel={L('Anterior', 'Previous')}>
                  <Icon name="chevronLeft" size={22} color={C.text} strokeWidth={2.4} />
                </Touchable>
                <T raw style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' }}>
                  {L(`Temporada ${shown.season} · Episodio ${shown.episode}`, `Season ${shown.season} · Episode ${shown.episode}`)}
                </T>
                <Touchable haptic="select" disabled={!next} onPress={() => next && onNavigate(next)} hitSlop={10} style={{ opacity: next ? 1 : 0.3, padding: 6 }} accessibilityLabel={L('Siguiente', 'Next')}>
                  <Icon name="chevronRight" size={22} color={C.text} strokeWidth={2.4} />
                </Touchable>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <T raw muted style={{ fontSize: 15, textAlign: 'center' }}>
                  {[ep.air_date && !isDemo ? date(ep.air_date) : null, ep.runtime ? `${ep.runtime} min` : null, ep.vote_average ? `★ ${ep.vote_average.toFixed(1)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
                {directors.length ? (
                  <T raw muted style={{ fontSize: 15 }}>
                    {L('Dirigido por ', 'Directed by ')}
                    <T raw style={{ fontSize: 15, fontWeight: '700' }}>
                      {directors.join(', ')}
                    </T>
                  </T>
                ) : null}
              </View>

              {aired ? (
                <View style={{ gap: Space.sm }}>
                  <Touchable
                    haptic={seen ? 'light' : 'success'}
                    pressScale={0.97}
                    onPress={() => {
                      onNeedItem();
                      lib.setEpisodes(key, [shown], !seen);
                    }}
                    style={[S.bigCheck, seen ? { backgroundColor: C.accent } : { ...glassFill(C) }]}>
                    <Icon name={seen ? 'checks' : 'check'} size={22} color={seen ? '#fff' : C.text} strokeWidth={2.6} />
                    <T raw style={{ fontSize: 16, fontWeight: '700', color: seen ? '#fff' : C.text }}>
                      {seen ? L('Visto', 'Watched') : L('Marcar como visto', 'Mark as watched')}
                    </T>
                  </Touchable>
                  {!seen && shown.episode > 1 ? (
                    <Touchable
                      haptic="medium"
                      onPress={() => {
                        onNeedItem();
                        lib.setEpisodes(
                          key,
                          (data?.episodes ?? [])
                            .filter((e) => e.episode_number <= shown.episode && e.air_date && e.air_date <= new Date().toISOString().slice(0, 10))
                            .map((e) => ({ season: shown.season, episode: e.episode_number })),
                          true,
                        );
                      }}
                      style={{ alignSelf: 'center', padding: 6 }}>
                      <T raw style={{ fontSize: 14, fontWeight: '700', color: C.accentInk }}>
                        {L('Marcar todo hasta aquí', 'Mark all up to here')}
                      </T>
                    </Touchable>
                  ) : null}
                </View>
              ) : (
                <T raw muted style={{ textAlign: 'center' }}>
                  {ep.air_date ? L(`Se estrena el ${date(ep.air_date)}.`, `Premieres ${date(ep.air_date)}.`) : L('Fecha por anunciar.', 'Date to be announced.')}
                </T>
              )}

              {aired ? (
                <Rating
                  compact
                  value={item?.episodeRatings?.[ek] ?? null}
                  onChange={(v) => {
                    onNeedItem();
                    lib.setEpisodeRating(key, ek, v);
                  }}
                />
              ) : null}

              <T raw style={{ fontSize: 16, lineHeight: 24 }}>
                {ep.overview || L('Sin sinopsis todavía.', 'No synopsis yet.')}
              </T>

              {aired && item ? (
                <Reactions value={item.reactions?.[ek] ?? []} onChange={(list) => lib.setReactions(key, ek, list)} />
              ) : null}

              <Touchable
                haptic="light"
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/episodio/[id]/[temporada]/[episodio]',
                    params: { id: String(tv.id), temporada: String(shown.season), episodio: String(shown.episode) },
                  });
                }}
                style={[S.textBtn, { alignSelf: 'center' }]}>
                <T raw style={{ fontSize: 15, fontWeight: '700', color: C.accentInk }}>
                  {L('Abrir página del episodio', 'Open episode page')}
                </T>
                <Icon name="chevronRight" size={16} color={C.accentInk} strokeWidth={2.4} />
              </Touchable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const S = StyleSheet.create({
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 18, borderRadius: 999 },
  checkWrap: { position: 'absolute', left: 0, right: 0, bottom: -15, alignItems: 'center' },
  checkPill: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bigCheck: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 4 },
});

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 16,
      borderRadius: 999,
      ...glassFill(C),
    },
    textBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 6 },
    segment: { flexDirection: 'row', borderRadius: 999, padding: 3, ...glassFill(C) },
    segBtn: { height: 36, paddingHorizontal: 11, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: C.mode === 'light' ? '#fff' : 'rgba(255,255,255,0.14)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
    seasonArt: {
      width: '100%',
      aspectRatio: 2 / 3,
      borderRadius: Radius.md,
      overflow: 'hidden',
      backgroundColor: C.fill,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    doneBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
    epStill: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: C.fill },
    chip: { position: 'absolute', backgroundColor: 'rgba(14,13,18,0.72)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
    epMore: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(14,13,18,0.5)',
    },
  });
