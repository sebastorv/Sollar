/**
 * Ficha de una película o serie, con la estructura de Bingebase:
 * portada a lo ancho con la carátula encima, "Serie · En emisión", título grande, datos, notas,
 * acciones (Seguir, Favorito, Lista, Calificar, Más), dónde ver y pestañas Episodios · Reparto ·
 * Detalles. Sobria: tinta negra o blanca, sin degradados.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { PopcornBag, PopcornRating, RATING_LABELS } from '@/components/brand';
import { Backdrop, card } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { AddToListSheet, entryFrom } from '@/components/lists';
import { ProviderLogo } from '@/components/platforms';
import { Sheet } from '@/components/sheet';
import { CastShelf, DetailsBlock, Recommendations, SeasonQuality } from '@/components/title-extras';
import { Touchable } from '@/components/touch';
import { Button, Empty, Loading, Poster, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { addDays, fromISO, todayISO } from '@/lib/dates';
import { itemKey, newItemFromMovie, newItemFromTv, seasonsFromTv } from '@/lib/library-item';
import { formatDuration, formatEpisode, nextEpisode, totalEpisodes, watchedCount } from '@/lib/progress';
import { availabilityFrom } from '@/lib/providers';
import { getExtras, getMovie, getSeason, getTv, getWatchProviders, isDemo, sharpImage, type TitleExtras } from '@/lib/tmdb';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  episodeKey,
  type LibraryItem,
  type MediaType,
  type TmdbEpisode,
  type TmdbMovie,
  type TmdbSeason,
  type TmdbTv,
  type TmdbWatchProviders,
  type WatchStatus,
} from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useColors, useStyles } from '@/store/theme';

type Details = { kind: 'movie'; data: TmdbMovie } | { kind: 'tv'; data: TmdbTv };
type Tab = 'episodes' | 'cast' | 'details';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** "12 mar 2024". */
function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = fromISO(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_TV: Record<string, string> = {
  'Returning Series': 'En emisión',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'En producción',
  Planned: 'Anunciada',
  Pilot: 'Piloto',
};

export default function TitleScreen() {
  const C = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const wide = screenWidth >= 900;
  const styles = useStyles(makeStyles);
  const params = useLocalSearchParams<{ tipo: string; id: string }>();
  const type: MediaType = params.tipo === 'tv' ? 'tv' : 'movie';
  const id = Number(params.id);
  const key = itemKey(type, id);

  const lib = useLibrary();
  const item = lib.get(key);

  const [details, setDetails] = useState<Details | null>(null);
  const [providers, setProviders] = useState<TmdbWatchProviders | null>(null);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<TitleExtras | null>(null);
  const [tab, setTab] = useState<Tab>(type === 'tv' ? 'episodes' : 'cast');
  const [sheet, setSheet] = useState<null | 'status' | 'rate' | 'lists' | 'watched' | 'more'>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDetails(null);
    setTab(type === 'tv' ? 'episodes' : 'cast');
    const load =
      type === 'tv'
        ? getTv(id).then((data): Details => ({ kind: 'tv', data }))
        : getMovie(id).then((data): Details => ({ kind: 'movie', data }));
    load.then((d) => !cancelled && setDetails(d)).catch((e: Error) => !cancelled && setError(e.message));
    setExtras(null);
    getExtras(type, id)
      .then((x) => !cancelled && setExtras(x))
      .catch(() => {});
    setProvidersLoaded(false);
    getWatchProviders(type, id)
      .then((p) => {
        if (cancelled) return;
        setProviders(p);
        setProvidersLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  // Si la serie ya está guardada, actualiza sus temporadas (por si salió una nueva).
  const savedSeasonsJson = item ? JSON.stringify(item.seasons) : null;
  useEffect(() => {
    if (details?.kind !== 'tv' || savedSeasonsJson == null) return;
    const fresh = seasonsFromTv(details.data);
    if (JSON.stringify(fresh) !== savedSeasonsJson) lib.refreshSeasons(key, fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, savedSeasonsJson, key]);

  const saved = Boolean(item);
  useEffect(() => {
    if (saved && providersLoaded) lib.setAvailability(key, availabilityFrom(providers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, providersLoaded, providers, key]);

  // Cambia la carátula guardada por la original, sin letreros de la plataforma.
  const cleanPoster = extras?.poster;
  useEffect(() => {
    if (saved && cleanPoster && item?.posterPath !== cleanPoster) lib.setPoster(key, cleanPoster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, cleanPoster, key]);

  if (error) {
    return (
      <View style={styles.page}>
        <Empty title="No se pudo cargar" message={error} action={<Button label="Volver" onPress={() => router.back()} />} />
      </View>
    );
  }
  if (!details) {
    return (
      <View style={styles.page}>
        <Loading />
      </View>
    );
  }

  const d = details.data;
  const isTv = details.kind === 'tv';
  const title = isTv ? details.data.name : details.data.title;
  const date = isTv ? details.data.first_air_date : details.data.release_date;
  const year = date?.slice(0, 4);
  const poster = extras?.poster ?? d.poster_path;

  // "2019–2024 · 4 temporadas · 36 episodios · 1 d 4 h" o "2023 · 2 h 10 min · +13".
  let meta: (string | null | undefined)[];
  if (isTv) {
    const tv = details.data;
    const ended = tv.status === 'Ended' || tv.status === 'Canceled';
    const lastYear = tv.last_air_date?.slice(0, 4);
    const runtime = tv.episode_run_time.find((n) => n > 0) ?? 0;
    meta = [
      year ? (ended && lastYear && lastYear !== year ? `${year}–${lastYear}` : ended ? year : `${year}–`) : null,
      `${tv.number_of_seasons} ${tv.number_of_seasons === 1 ? 'temporada' : 'temporadas'}`,
      tv.number_of_episodes ? `${tv.number_of_episodes} episodios` : null,
      runtime && tv.number_of_episodes ? formatDuration(runtime * tv.number_of_episodes) : null,
      extras?.certification,
    ];
  } else {
    meta = [year, details.data.runtime ? formatDuration(details.data.runtime) : null, extras?.certification];
  }
  const overline = isTv ? ['Serie', STATUS_TV[details.data.status]].filter(Boolean).join(' · ') : 'Película';
  const genres = d.genres.slice(0, 3).map((g) => g.name).join(' · ');

  const entry = entryFrom({ key, tmdbId: id, mediaType: type, title, posterPath: poster, year: year ?? null });

  function add(status: WatchStatus) {
    const created = details!.kind === 'tv' ? newItemFromTv(details!.data, status) : newItemFromMovie(details!.data, status);
    const withArt = extras?.poster ? { ...created, posterPath: extras.poster } : created;
    lib.save(providersLoaded ? { ...withArt, availability: availabilityFrom(providers) } : withArt);
  }
  /** Para acciones que necesitan el título guardado (marcar episodios, calificar). */
  function ensure(status: WatchStatus) {
    if (!lib.get(key)) add(status);
  }

  async function share() {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : `https://www.themoviedb.org/${type}/${id}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title, url });
      else await Share.share({ message: `${title} ${url}` });
    } catch {
      // Cancelado.
    }
  }

  const heroH = wide ? Math.min(Math.round(screenWidth * 0.34), 560) : Math.min(Math.round(screenWidth * 0.62), 340);
  const backdrop = sharpImage(extras?.backdrop ?? d.backdrop_path, 'backdrop', screenWidth);
  const posterW = wide ? 240 : 118;

  const headerText = (
    <View style={{ flex: 1, gap: 6, justifyContent: 'flex-end' }}>
      <T style={styles.overline}>{overline.toUpperCase()}</T>
      <T style={[styles.title, wide && { fontSize: 44, lineHeight: 50 }]}>{title}</T>
      <T variant="small" muted>
        {meta.filter(Boolean).join(' · ')}
      </T>
      {genres ? (
        <T variant="small" style={{ color: C.textFaint }}>
          {genres}
        </T>
      ) : null}
    </View>
  );

  const scores = (
    <ScoreRow tmdb={d.vote_average} votes={extras?.voteCount ?? 0} item={item} isTv={isTv} onRate={() => setSheet('rate')} />
  );

  const actions = (
    <ActionRow
      item={item}
      isTv={isTv}
      inLists={lib.lists.filter((l) => l.entries.some((e) => e.key === key)).length}
      onTrack={() => (item ? setSheet('status') : add('planned'))}
      onWatched={() => setSheet('watched')}
      onFavorite={() => {
        ensure(isTv ? 'watching' : 'completed');
        lib.toggleFavorite(key);
      }}
      onLists={() => setSheet('lists')}
      onRate={() => setSheet('rate')}
      onMore={() => setSheet('more')}
    />
  );

  const overview = (
    <View style={{ gap: Space.sm }}>
      {d.tagline ? (
        <T muted style={{ fontStyle: 'italic' }}>
          {d.tagline}
        </T>
      ) : null}
      <Touchable haptic="select" pressScale={1} onPress={() => setOverviewOpen(!overviewOpen)}>
        <T style={styles.overview} numberOfLines={overviewOpen ? undefined : 4}>
          {d.overview || 'Sin sinopsis en español todavía.'}
        </T>
        {d.overview && d.overview.length > 240 ? (
          <T variant="label" style={{ marginTop: 4 }}>
            {overviewOpen ? 'Ver menos' : 'Ver más'}
          </T>
        ) : null}
      </Touchable>
    </View>
  );

  const tabs: [Tab, string][] = isTv
    ? [
        ['episodes', 'Episodios'],
        ['cast', 'Reparto'],
        ['details', 'Detalles'],
      ]
    : [
        ['cast', 'Reparto'],
        ['details', 'Detalles'],
      ];

  const body = (
    <View style={{ gap: Space.xl }}>
      <View style={styles.tabs}>
        {tabs.map(([k, label]) => {
          const on = tab === k;
          return (
            <Touchable
              key={k}
              haptic="select"
              pressScale={0.96}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { borderBottomColor: C.text }]}>
              <T style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? C.text : C.textMuted }}>{label}</T>
            </Touchable>
          );
        })}
      </View>

      {tab === 'episodes' && details.kind === 'tv' ? (
        <Episodes tv={details.data} item={item} wide={wide} onNeedItem={() => ensure('watching')} />
      ) : null}
      {tab === 'cast' ? (
        extras ? (
          extras.cast.length ? (
            <CastShelf cast={extras.cast} />
          ) : (
            <T muted>Sin reparto registrado.</T>
          )
        ) : (
          <Loading />
        )
      ) : null}
      {tab === 'details' ? (
        <View style={{ gap: Space.xl }}>
          {extras ? <DetailsBlock extras={extras} type={type} id={id} status={isTv ? details.data.status : undefined} /> : <Loading />}
          {details.kind === 'tv' ? <SeasonQuality seasons={details.data.seasons} /> : null}
          {item ? <NoteBox item={item} /> : null}
        </View>
      ) : null}

      <InYourLists entryKey={key} />
      {extras ? <Recommendations items={extras.recommendations} /> : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <Backdrop />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 96 }}>
        <View style={{ height: heroH }}>
          {backdrop ? (
            <>
              <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              <LinearGradient
                colors={['rgba(0,0,0,0.25)', 'transparent', C.mode === 'dark' ? 'rgba(11,11,13,0.6)' : 'rgba(246,246,247,0.55)', C.bg]}
                locations={[0, 0.3, 0.75, 1]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.fill }]} />
          )}
        </View>

        <View style={[styles.content, wide && styles.contentWide]}>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: Space.xxl + Space.md }}>
              {/* Columna izquierda: carátula y dónde ver. */}
              <View style={{ width: posterW, gap: Space.xl, marginTop: -Math.round(posterW * 0.9) }}>
                <Poster path={poster} title={title} width={posterW} style={styles.poster} />
                <WhereToWatch providers={providers} loaded={providersLoaded} compact />
              </View>
              <View style={{ flex: 1, gap: Space.xl, minWidth: 0 }}>
                <View style={{ marginTop: -Space.xxl * 2 }}>{headerText}</View>
                {scores}
                {actions}
                {overview}
                {body}
              </View>
            </View>
          ) : (
            <View style={{ gap: Space.xl }}>
              <View style={{ flexDirection: 'row', gap: Space.lg, alignItems: 'flex-end', marginTop: -Math.round(posterW * 0.75) }}>
                <Poster path={poster} title={title} width={posterW} style={styles.poster} />
                {headerText}
              </View>
              {scores}
              {actions}
              {overview}
              <WhereToWatch providers={providers} loaded={providersLoaded} />
              {body}
            </View>
          )}
        </View>
      </ScrollView>

      <Sheet visible={sheet === 'status'} onClose={() => setSheet(null)} title="Estado" subtitle={title}>
        <View style={{ gap: 2 }}>
          {STATUS_ORDER.map((s) => (
            <OptionRow
              key={s}
              label={STATUS_LABEL[s]}
              on={item?.status === s}
              onPress={() => {
                if (item) lib.setStatus(key, s);
                else add(s);
                setSheet(null);
              }}
            />
          ))}
        </View>
        {item?.mediaType === 'tv' && item.status === 'completed' ? (
          <Button
            label="Volver a verla desde el principio"
            kind="secondary"
            onPress={() => {
              lib.restartShow(key);
              setSheet(null);
            }}
          />
        ) : null}
        {item ? (
          <Button
            label="Quitar de mi lista"
            kind="danger"
            onPress={() => {
              lib.remove(key);
              setSheet(null);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'rate'} onClose={() => setSheet(null)} title="¿Qué tal estuvo?" subtitle={title}>
        <PopcornRating
          value={item?.rating ?? null}
          onChange={(v) => {
            ensure(isTv ? 'watching' : 'completed');
            lib.setRating(key, v);
          }}
        />
        <Button label="Listo" onPress={() => setSheet(null)} />
      </Sheet>

      {details.kind === 'movie' ? (
        <WatchSheet
          visible={sheet === 'watched'}
          onClose={() => setSheet(null)}
          item={item}
          releaseDate={details.data.release_date}
          onEnsure={() => ensure('completed')}
          itemKey={key}
        />
      ) : null}

      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)} title={title}>
        <View style={{ gap: 2 }}>
          {extras?.trailerKey ? (
            <OptionRow
              icon="film"
              label="Ver tráiler"
              onPress={() => {
                setSheet(null);
                Linking.openURL(`https://www.youtube.com/watch?v=${extras.trailerKey}`);
              }}
            />
          ) : null}
          <OptionRow
            icon="share"
            label="Compartir"
            onPress={() => {
              setSheet(null);
              share();
            }}
          />
          <OptionRow icon="screen" label="Ver en TMDB" onPress={() => Linking.openURL(`https://www.themoviedb.org/${type}/${id}`)} />
          {extras?.imdbId ? (
            <OptionRow icon="screen" label="Ver en IMDb" onPress={() => Linking.openURL(`https://www.imdb.com/title/${extras.imdbId}/`)} />
          ) : null}
          {item ? (
            <OptionRow
              icon="trash"
              label="Quitar de mi lista"
              danger
              onPress={() => {
                lib.remove(key);
                setSheet(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <AddToListSheet visible={sheet === 'lists'} entry={entry} onClose={() => setSheet(null)} />
    </View>
  );
}

// --- Notas ---

function ScoreRow({
  tmdb,
  votes,
  item,
  isTv,
  onRate,
}: {
  tmdb: number;
  votes: number;
  item: LibraryItem | undefined;
  isTv: boolean;
  onRate: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const seen = item && isTv ? watchedCount(item) : 0;
  const total = item && isTv ? totalEpisodes(item.seasons) : 0;
  const times = item && !isTv ? (item.watchedAt ? 1 : 0) + (item.rewatches?.length ?? 0) : 0;
  return (
    <View style={styles.scores}>
      {tmdb > 0 ? (
        <View style={styles.score}>
          <T style={styles.scoreValue}>
            {tmdb.toFixed(1)}
            <T style={styles.scoreOf}>/10</T>
          </T>
          <T variant="caption" muted numberOfLines={1}>
            TMDB{votes ? ` · ${votes >= 1000 ? `${(votes / 1000).toFixed(votes >= 10000 ? 0 : 1)} mil` : votes} votos` : ''}
          </T>
        </View>
      ) : null}
      <Touchable haptic="select" pressScale={0.97} onPress={onRate} style={styles.score} accessibilityLabel="Calificar">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PopcornBag filled={!!item?.rating} size={22} />
          {item?.rating ? (
            <T style={styles.scoreValue}>
              {item.rating}
              <T style={styles.scoreOf}>/10</T>
            </T>
          ) : (
            <T style={[styles.scoreValue, { fontSize: 17 }]}>Calificar</T>
          )}
        </View>
        <T variant="caption" muted numberOfLines={1}>
          {item?.rating ? RATING_LABELS[item.rating] : 'Tu nota'}
        </T>
      </Touchable>
      {item ? (
        <View style={styles.score}>
          {isTv ? (
            <T style={styles.scoreValue}>
              {seen}
              <T style={styles.scoreOf}>/{total}</T>
            </T>
          ) : (
            <T style={styles.scoreValue}>{times ? `${times}×` : '—'}</T>
          )}
          <T variant="caption" muted numberOfLines={1}>
            {isTv ? 'Episodios vistos' : times ? (times === 1 ? 'La viste' : 'Veces vista') : 'Sin ver'}
          </T>
          {isTv && total ? (
            <View style={{ height: 3, borderRadius: 2, backgroundColor: C.fill, overflow: 'hidden', marginTop: 4 }}>
              <View style={{ height: '100%', width: `${Math.round((seen / total) * 100)}%`, backgroundColor: C.ink }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// --- Acciones ---

function ActionRow({
  item,
  isTv,
  inLists,
  onTrack,
  onWatched,
  onFavorite,
  onLists,
  onRate,
  onMore,
}: {
  item: LibraryItem | undefined;
  isTv: boolean;
  inLists: number;
  onTrack: () => void;
  onWatched: () => void;
  onFavorite: () => void;
  onLists: () => void;
  onRate: () => void;
  onMore: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const watchedMovie = !isTv && !!item?.watchedAt;
  return (
    <View style={{ gap: Space.md, maxWidth: 620 }}>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <Touchable
          haptic="medium"
          onPress={onTrack}
          accessibilityRole="button"
          style={[styles.track, item ? { backgroundColor: C.fill } : { backgroundColor: C.ink }]}>
          <View>
            <Icon name={item ? 'check' : 'plus'} size={18} color={item ? C.text : C.onInk} strokeWidth={2.6} />
          </View>
          <T style={{ fontSize: 15, fontWeight: '700', color: item ? C.text : C.onInk }}>
            {item ? STATUS_LABEL[item.status] : isTv ? 'Seguir' : 'Quiero verla'}
          </T>
          {item ? (
            <View>
              <Icon name="chevronDown" size={16} color={C.textMuted} strokeWidth={2.4} />
            </View>
          ) : null}
        </Touchable>
        {!isTv ? (
          <Touchable
            haptic="medium"
            onPress={onWatched}
            accessibilityRole="button"
            style={[styles.track, { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface }]}>
            <View>
              <Icon name={watchedMovie ? 'plus' : 'check'} size={18} color={C.text} strokeWidth={2.6} />
            </View>
            <T style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{watchedMovie ? 'La vi otra vez' : 'La vi'}</T>
          </Touchable>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Action icon="heart" label="Favorito" on={!!item?.favorite} onPress={onFavorite} />
        <Action
          icon="ticket"
          label={inLists ? `${inLists} ${inLists === 1 ? 'lista' : 'listas'}` : 'Lista'}
          on={inLists > 0}
          onPress={onLists}
        />
        <Action icon="sparkle" label="Calificar" on={!!item?.rating} onPress={onRate} />
        <Action icon="more" label="Más" onPress={onMore} />
      </View>
    </View>
  );
}

function Action({ icon, label, on, onPress }: { icon: IconName; label: string; on?: boolean; onPress: () => void }) {
  const C = useColors();
  return (
    <Touchable
      onPress={onPress}
      haptic={icon === 'heart' ? 'medium' : 'light'}
      pressScale={0.9}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: Space.xs }}>
      <View>
        <Icon name={icon} size={23} color={C.text} filled={on} strokeWidth={1.9} />
      </View>
      <T variant="caption" numberOfLines={1} style={{ color: on ? C.text : C.textMuted, fontWeight: on ? '700' : '500' }}>
        {label}
      </T>
    </Touchable>
  );
}

function OptionRow({
  label,
  icon,
  on,
  danger,
  onPress,
}: {
  label: string;
  icon?: IconName;
  on?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      haptic="select"
      pressScale={0.98}
      onPress={onPress}
      style={styles.option}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}>
      {icon ? (
        <View>
          <Icon name={icon} size={20} color={danger ? C.danger : C.text} />
        </View>
      ) : null}
      <T style={{ flex: 1, fontSize: 16, fontWeight: on ? '700' : '500', color: danger ? C.danger : C.text }}>{label}</T>
      {on ? (
        <View>
          <Icon name="check" size={18} color={C.text} strokeWidth={2.6} />
        </View>
      ) : null}
    </Touchable>
  );
}

// --- Película vista: ahora, ayer, el estreno u otra fecha ---

function WatchSheet({
  visible,
  onClose,
  item,
  releaseDate,
  onEnsure,
  itemKey: key,
}: {
  visible: boolean;
  onClose: () => void;
  item: LibraryItem | undefined;
  releaseDate: string;
  onEnsure: () => void;
  itemKey: string;
}) {
  const C = useColors();
  const lib = useLibrary();
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(todayISO());
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date <= todayISO();
  const again = !!item?.watchedAt;
  const history = item ? [item.watchedAt, ...(item.rewatches ?? [])].filter((x): x is string => !!x) : [];

  function save(at: string) {
    onEnsure();
    if (again) lib.addMovieRewatch(key, at);
    else lib.setMovieWatchedAt(key, at);
    setPicking(false);
    onClose();
  }
  /** Las 8 p. m. de ese día, hora local. */
  const at = (iso: string) => new Date(iso + 'T20:00:00').toISOString();
  const released = !!releaseDate && releaseDate <= todayISO();

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setPicking(false);
        onClose();
      }}
      title={again ? '¿La viste otra vez?' : '¿Cuándo la viste?'}>
      {history.length ? (
        <T variant="small" muted>
          {history.length === 1 ? 'La viste el ' : `La has visto ${history.length} veces: `}
          {history.map((h) => shortDate(h)).join(', ')}.
        </T>
      ) : null}
      {!picking ? (
        <View style={{ gap: 2 }}>
          <OptionRow icon="check" label="Ahora" onPress={() => save(new Date().toISOString())} />
          <OptionRow icon="clock" label="Ayer" onPress={() => save(at(addDays(todayISO(), -1)))} />
          {released && !again ? (
            <OptionRow icon="calendar" label={`El día del estreno (${shortDate(releaseDate)})`} onPress={() => save(at(releaseDate))} />
          ) : null}
          <OptionRow icon="edit" label="Otra fecha" onPress={() => setPicking(true)} />
          {again ? (
            <OptionRow
              icon="trash"
              label="Desmarcar como vista"
              danger
              onPress={() => {
                lib.setMovieWatched(key, false);
                onClose();
              }}
            />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: Space.md }}>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.currentTarget.value)}
              style={{
                fontSize: 16,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: C.fill,
                color: C.text,
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2024-05-31"
              placeholderTextColor={C.textFaint}
              style={{ backgroundColor: C.fill, color: C.text, borderRadius: 12, padding: 12, fontSize: 16 }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            <Button label="Guardar" disabled={!valid} onPress={() => save(at(date))} style={{ flex: 1 }} />
            <Button label="Cancelar" kind="secondary" onPress={() => setPicking(false)} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

// --- Episodios ---

function Episodes({
  tv,
  item,
  wide,
  onNeedItem,
}: {
  tv: TmdbTv;
  item: LibraryItem | undefined;
  wide: boolean;
  onNeedItem: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const seasons = useMemo(() => seasonsFromTv(tv), [tv]);
  const next = item ? nextEpisode(item) : seasons.length ? { season: seasons[0].seasonNumber, episode: 1 } : null;
  const [season, setSeason] = useState<number>(next?.season ?? seasons[0]?.seasonNumber ?? 1);
  const [data, setData] = useState<TmdbSeason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newest, setNewest] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);

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

  const today = todayISO();
  const key = itemKey('tv', tv.id);
  const seen = (s: number, e: number) => Boolean(item?.watchedEpisodes[episodeKey(s, e)]);
  const aired = (data?.episodes ?? []).filter((e) => e.air_date && e.air_date <= today);
  const allSeen = aired.length > 0 && aired.every((e) => seen(season, e.episode_number));
  const seasonRuntime = (data?.episodes ?? []).reduce((a, e) => a + (e.runtime ?? 0), 0);

  function toggle(ep: TmdbEpisode) {
    onNeedItem();
    lib.setEpisodes(key, [{ season, episode: ep.episode_number }], !seen(season, ep.episode_number));
  }
  function markUpTo(ep: TmdbEpisode) {
    onNeedItem();
    lib.setEpisodes(
      key,
      aired.filter((e) => e.episode_number <= ep.episode_number).map((e) => ({ season, episode: e.episode_number })),
      true,
    );
  }

  let list = data?.episodes ?? [];
  if (hideWatched) list = list.filter((e) => !seen(season, e.episode_number));
  if (newest) list = [...list].reverse();
  const nextEp = next && next.season === season ? data?.episodes.find((e) => e.episode_number === next.episode) : null;
  const nextStill = nextEp ? sharpImage(nextEp.still_path, 'still', wide ? 260 : 140) : null;

  return (
    <View style={{ gap: Space.lg }}>
      {/* Lo que sigue: "Empieza desde" o "Sigue con". */}
      {nextEp && nextEp.air_date && nextEp.air_date <= today ? (
        <View style={styles.nextCard}>
          <View style={[styles.nextStill, wide && { width: 260 }]}>
            {nextStill ? <Image source={{ uri: nextStill }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={{ flex: 1, gap: 2, justifyContent: 'center', minWidth: 0 }}>
            <T variant="caption" muted style={{ fontWeight: '700', letterSpacing: 0.6 }}>
              {(item && watchedCount(item) > 0 ? 'Sigue con' : 'Empieza desde').toUpperCase()}
            </T>
            <T style={{ fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {formatEpisode(season, nextEp.episode_number)} · {nextEp.name}
            </T>
            <T variant="caption" muted numberOfLines={1}>
              {[nextEp.runtime ? `${nextEp.runtime} min` : null, shortDate(nextEp.air_date)].filter(Boolean).join(' · ')}
            </T>
          </View>
          <CheckButton on={false} onPress={() => toggle(nextEp)} />
        </View>
      ) : null}

      {/* Temporadas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
        {seasons.map((s) => {
          const on = s.seasonNumber === season;
          const count = item
            ? Array.from({ length: s.episodeCount }, (_, i) => i + 1).filter((e) => seen(s.seasonNumber, e)).length
            : 0;
          const stub = tv.seasons.find((x) => x.season_number === s.seasonNumber);
          return (
            <Touchable
              key={s.seasonNumber}
              haptic="select"
              pressScale={0.96}
              onPress={() => setSeason(s.seasonNumber)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.seasonCard, on && { borderColor: C.text }]}>
              <T style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                Temporada {s.seasonNumber}
              </T>
              <T variant="caption" muted numberOfLines={1}>
                {[`${s.episodeCount} ep.`, stub?.air_date?.slice(0, 4)].filter(Boolean).join(' · ')}
              </T>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: C.fill, overflow: 'hidden', marginTop: 6 }}>
                <View style={{ height: '100%', width: `${Math.round((count / s.episodeCount) * 100)}%`, backgroundColor: C.ink }} />
              </View>
              <T variant="caption" style={{ color: C.textFaint, marginTop: 2 }}>
                {count === s.episodeCount && count > 0 ? 'Completa' : `${count}/${s.episodeCount} vistos`}
              </T>
            </Touchable>
          );
        })}
      </ScrollView>

      {/* Resumen y filtros */}
      <View style={{ gap: Space.sm }}>
        <T variant="small" muted>
          {[
            data ? `${data.episodes.length} episodios` : null,
            seasonRuntime ? `${formatDuration(seasonRuntime)} en total` : null,
            data?.air_date ? shortDate(data.air_date) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' }}>
          <Pill
            label={newest ? 'Más recientes' : 'Más antiguos'}
            icon={newest ? 'arrowDown' : 'arrowUp'}
            onPress={() => setNewest(!newest)}
          />
          <Pill label="Ocultar vistos" on={hideWatched} onPress={() => setHideWatched(!hideWatched)} />
          <View style={{ flex: 1 }} />
          <Touchable
            haptic="medium"
            disabled={aired.length === 0}
            onPress={() => {
              onNeedItem();
              lib.setEpisodes(
                key,
                aired.map((e) => ({ season, episode: e.episode_number })),
                !allSeen,
              );
            }}
            style={{ opacity: aired.length ? 1 : 0.4, paddingVertical: 6 }}>
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              {allSeen ? 'Desmarcar temporada' : 'Marcar temporada'}
            </T>
          </Touchable>
        </View>
      </View>

      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      {!data && !error ? <Loading /> : null}

      <View style={{ gap: Space.lg }}>
        {list.map((ep) => {
          const isSeen = seen(season, ep.episode_number);
          const upcoming = !ep.air_date || ep.air_date > today;
          const still = sharpImage(ep.still_path, 'still', wide ? 220 : 128);
          const tag =
            ep.episode_type === 'finale'
              ? 'Final'
              : ep.episode_number === 1
                ? 'Estreno'
                : ep.episode_type === 'mid_season'
                  ? 'Mitad de temporada'
                  : null;
          return (
            <View key={ep.id} style={[styles.episode, upcoming && { opacity: 0.55 }]}>
              <View style={[styles.still, wide && { width: 220 }]}>
                {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                {isSeen ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} /> : null}
              </View>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <T variant="caption" muted numberOfLines={1}>
                  {[
                    `E${ep.episode_number}`,
                    ep.runtime ? `${ep.runtime} min` : null,
                    upcoming
                      ? ep.air_date
                        ? `Sale el ${shortDate(ep.air_date)}`
                        : 'Fecha por anunciar'
                      : isDemo
                        ? null
                        : shortDate(ep.air_date),
                    tag,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
                <T style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
                  {ep.name}
                </T>
                {ep.overview ? (
                  <T variant="small" muted numberOfLines={wide ? 3 : 2}>
                    {ep.overview}
                  </T>
                ) : null}
              </View>
              {!upcoming ? <CheckButton on={isSeen} onPress={() => toggle(ep)} onLongPress={() => markUpTo(ep)} /> : null}
            </View>
          );
        })}
        {data && list.length === 0 ? <T muted>Viste toda esta temporada.</T> : null}
      </View>
      {data && aired.length > 1 ? (
        <T variant="caption" muted>
          Mantén presionado ✓ para marcar también los episodios anteriores.
        </T>
      ) : null}
    </View>
  );
}

function CheckButton({ on, onPress, onLongPress }: { on: boolean; onPress: () => void; onLongPress?: () => void }) {
  const C = useColors();
  return (
    <Touchable
      haptic={on ? 'light' : 'success'}
      pressScale={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Desmarcar' : 'Marcar como visto'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? C.ink : 'transparent',
        borderWidth: on ? 0 : 1.5,
        borderColor: C.textFaint,
      }}>
      <View>
        <Icon name="check" size={18} color={on ? C.onInk : C.textMuted} strokeWidth={2.6} />
      </View>
    </Touchable>
  );
}

function Pill({ label, icon, on, onPress }: { label: string; icon?: IconName; on?: boolean; onPress: () => void }) {
  const C = useColors();
  return (
    <Touchable
      haptic="select"
      onPress={onPress}
      accessibilityState={{ selected: on }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Space.md,
        height: 34,
        borderRadius: Radius.pill,
        backgroundColor: on ? C.ink : C.fill,
      }}>
      {icon ? (
        <View>
          <Icon name={icon} size={14} color={on ? C.onInk : C.text} strokeWidth={2.4} />
        </View>
      ) : null}
      <T variant="label" style={{ fontSize: 13, color: on ? C.onInk : C.text }}>
        {label}
      </T>
    </Touchable>
  );
}

// --- Nota personal ---

function NoteBox({ item }: { item: LibraryItem }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const [note, setNote] = useState(item.note);
  return (
    <View style={{ gap: Space.sm }}>
      <T variant="heading">Nota personal</T>
      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={() => note !== item.note && lib.setNote(item.key, note)}
        placeholder="Qué te pareció, quién te la recomendó…"
        placeholderTextColor={C.textFaint}
        multiline
        style={styles.note}
      />
    </View>
  );
}

// --- En tus listas ---

function InYourLists({ entryKey }: { entryKey: string }) {
  const C = useColors();
  const lib = useLibrary();
  const lists = lib.lists.filter((l) => l.entries.some((e) => e.key === entryKey));
  if (!lists.length) return null;
  return (
    <View style={{ gap: Space.md }}>
      <T variant="heading">En tus listas</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {lists.map((l) => (
          <Link key={l.id} href={{ pathname: '/lista/[id]', params: { id: l.id } }} asChild>
            <Touchable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: Space.md,
                height: 36,
                borderRadius: Radius.pill,
                backgroundColor: C.fill,
              }}>
              <View>
                <Icon name="ticket" size={15} color={C.text} />
              </View>
              <T variant="label">{l.name}</T>
            </Touchable>
          </Link>
        ))}
      </View>
    </View>
  );
}

// --- Dónde ver ---

function WhereToWatch({
  providers,
  loaded,
  compact,
}: {
  providers: TmdbWatchProviders | null;
  loaded: boolean;
  compact?: boolean;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { myProviders } = useSettings();
  const mine = new Set(myProviders);
  const groups: [string, TmdbWatchProviders['flatrate']][] = [
    ['Suscripción', providers?.flatrate],
    ['Gratis', [...(providers?.free ?? []), ...(providers?.ads ?? [])]],
    ['Alquiler', providers?.rent],
    ['Compra', providers?.buy],
  ];
  const any = groups.some(([, list]) => list && list.length > 0);
  const included = [...(providers?.flatrate ?? []), ...(providers?.free ?? []), ...(providers?.ads ?? [])];
  const matchNames = [...new Set(included.filter((p) => mine.has(p.provider_id)).map((p) => p.provider_name))];

  return (
    <View style={{ gap: Space.md }}>
      <T variant="heading">Dónde ver</T>
      {!loaded ? (
        <Loading />
      ) : (
        <>
          {matchNames.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
              <View>
                <Icon name="check" size={16} color={C.success} strokeWidth={2.8} />
              </View>
              <T variant="small" style={{ flex: 1, fontWeight: '600' }}>
                Incluido en tu plan: {matchNames.join(', ')}
              </T>
            </View>
          ) : myProviders.length === 0 ? (
            <Touchable onPress={() => router.navigate('/perfil')}>
              <T variant="small" muted>
                Elige tus plataformas en Perfil para saber si está incluido en tu plan.
              </T>
            </Touchable>
          ) : !any ? (
            <T variant="small" muted>
              Por ahora no aparece en ningún servicio de tu país.
            </T>
          ) : null}
          {groups.map(([label, list]) =>
            list && list.length > 0 ? (
              <View key={label} style={{ gap: Space.sm }}>
                <T variant="caption" muted style={{ fontWeight: '600', letterSpacing: 0.4 }}>
                  {label.toUpperCase()}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                  {list.map((p) => (
                    <View
                      key={p.provider_id}
                      style={[styles.provider, compact && { paddingRight: Space.xs }, mine.has(p.provider_id) && { borderColor: C.text }]}>
                      <ProviderLogo name={p.provider_name} logoPath={p.logo_path || null} />
                      {!compact ? (
                        <T variant="caption" style={{ fontWeight: mine.has(p.provider_id) ? '700' : '500' }}>
                          {p.provider_name}
                        </T>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null,
          )}
          <T variant="caption" style={{ color: C.textFaint }}>
            {isDemo ? 'Disponibilidad de ejemplo.' : 'Datos de JustWatch.'}
          </T>
        </>
      )}
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: C.bg },
    content: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: Space.lg },
    contentWide: { paddingHorizontal: Space.xxl + Space.md },
    poster: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      borderWidth: 1,
      borderColor: C.border,
    },
    overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: C.textMuted },
    title: { fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.8, color: C.text },
    overview: { fontSize: 16, lineHeight: 24, color: C.text },
    scores: { flexDirection: 'row', gap: Space.sm },
    score: {
      ...card(C),
      flex: 1,
      maxWidth: 200,
      borderRadius: Radius.md,
      paddingHorizontal: Space.md,
      paddingVertical: Space.md - 2,
      gap: 2,
    },
    scoreValue: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5, color: C.text },
    scoreOf: { fontSize: 13, fontWeight: '600', color: C.textFaint },
    track: {
      flex: 1,
      height: 48,
      borderRadius: Radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Space.sm,
    },
    actions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: C.border,
      paddingVertical: Space.sm,
    },
    option: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.xs },
    tabs: { flexDirection: 'row', gap: Space.xl, borderBottomWidth: 1, borderBottomColor: C.border },
    tab: { paddingVertical: Space.md, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
    nextCard: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      padding: Space.sm,
      paddingRight: Space.md,
      borderRadius: Radius.lg,
    },
    nextStill: { width: 140, aspectRatio: 16 / 9, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: C.fill },
    seasonCard: {
      ...card(C),
      width: 150,
      padding: Space.md,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      gap: 1,
    },
    episode: { flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' },
    still: { width: 128, aspectRatio: 16 / 9, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: C.fill },
    note: {
      minHeight: 80,
      backgroundColor: C.fill,
      borderRadius: Radius.md,
      padding: Space.md,
      color: C.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    provider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.xs,
      ...card(C),
      padding: Space.xs,
      paddingRight: Space.md,
      borderRadius: Radius.pill,
    },
  });
