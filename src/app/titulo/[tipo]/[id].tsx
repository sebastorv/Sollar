/**
 * Ficha de una película o serie, con la estructura de Bingebase:
 * portada a lo ancho con la carátula encima, "Serie · En emisión", título grande, datos, notas,
 * acciones (Seguir, Favorito, Lista, Calificar, Más), dónde ver y pestañas Episodios · Reparto ·
 * Detalles. Sobria: tinta negra o blanca, sin degradados.
 */

import { tr } from '@/i18n';
import { HScroll } from '@/components/hscroll';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rating, Reactions } from '@/components/rating';
import { Backdrop, card, GlassButton, glassFill } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { AddToListSheet, entryFrom } from '@/components/lists';
import { ProviderWordmark } from '@/components/platforms';
import { Gallery } from '@/components/gallery';
import { anchorOf, BubbleMenu, Sheet, type Anchor, type PressLike } from '@/components/sheet';
import { EpisodePanel, ProgressSummary, SeasonsBlock, UpNext } from '@/components/episodes';
import { Credits } from '@/components/credits';
import { Soundtrack } from '@/components/soundtrack';
import { DetailsBlock, Recommendations, SeasonQuality } from '@/components/title-extras';
import { Touchable } from '@/components/touch';
import { Button, Empty, FadeIn, Loading, Poster, T } from '@/components/ui';
import { Gutter, Radius, Space, type Colors } from '@/constants/theme';
import { withAlpha } from '@/constants/theme';
import { addDays, fromISO, todayISO } from '@/lib/dates';
import { itemKey, newItemFromMovie, newItemFromTv, seasonsFromTv } from '@/lib/library-item';
import { formatDuration, formatEpisode, nextEpisode } from '@/lib/progress';
import { availabilityFrom } from '@/lib/providers';
import { getRatings, type ExternalRating, getExtras, getMovie, getTv, getWatchProviders, isDemo, sharpImage, type TitleExtras } from '@/lib/tmdb';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  type LibraryItem,
  type MediaType,
  type TmdbMovie,
  type TmdbTv,
  type TmdbWatchProviders,
  type WatchStatus,
} from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { DarkScope, useColors, useStyles } from '@/store/theme';

type Details = { kind: 'movie'; data: TmdbMovie } | { kind: 'tv'; data: TmdbTv };
type Tab = 'info' | 'episodes' | 'cast' | 'music' | 'media';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** "12 mar 2024". */
function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = fromISO(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Fondo de la portada: siempre oscuro, para que las letras claras contrasten con la imagen. */

/** Entrega los colores y estilos del tema que rige en ese punto (por ejemplo, dentro de DarkScope). */
function WithTheme({ children }: { children: (C: Colors, styles: ReturnType<typeof makeStyles>) => React.ReactNode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return <>{children(C, styles)}</>;
}

const STATUS_TV: Record<string, string> = {
  'Returning Series': 'En emisión',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'En producción',
  Planned: 'Anunciada',
  Pilot: 'Piloto',
};

/** Toda la ficha va en modo oscuro, como Bingebase: la imagen de fondo y el texto se leen mejor. */
export default function TitleScreen() {
  return (
    <DarkScope>
      <TitleScreenBody />
    </DarkScope>
  );
}

function TitleScreenBody() {
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
  const [tab, setTab] = useState<Tab>('info');
  const [bubble, setBubble] = useState<{ kind: 'status' | 'more'; anchor: Anchor } | null>(null);
  const center = { x: screenWidth / 2 - 20, y: 300, width: 40, height: 40 };
  async function openBubble(kind: 'status' | 'more', e?: PressLike) {
    setBubble({ kind, anchor: await anchorOf(e, center) });
  }
  // Calificar, Listas y "La vi" salen en una burbuja pegada al botón tocado.
  const [sheetAnchor, setSheetAnchor] = useState<Anchor | null>(null);
  async function openSheet(kind: 'rate' | 'lists' | 'watched', e?: PressLike) {
    setSheetAnchor(await anchorOf(e, center));
    setSheet(kind);
  }
  /** En computador el episodio se abre en un panel a la derecha; en celular, en su página. */
  function openEpisode(t: { season: number; episode: number }) {
    if (wide) setEpisodeOpen(t);
    else
      router.push({
        pathname: '/episodio/[id]/[temporada]/[episodio]',
        params: { id: String(id), temporada: String(t.season), episodio: String(t.episode) },
      });
  }
  const [episodeOpen, setEpisodeOpen] = useState<{ season: number; episode: number } | null>(null);
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<null | 'status' | 'rate' | 'lists' | 'watched' | 'more'>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDetails(null);
    setTab('info');
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

  const heroH = wide ? Math.min(Math.round(screenWidth * 0.36), 600) : Math.round(Math.min(screenWidth, 520) * 0.95);
  const backdrop = sharpImage(extras?.backdrop ?? d.backdrop_path, 'backdrop', screenWidth);
  const logo = extras?.logo ? sharpImage(extras.logo, 'logo', wide ? 520 : 300) : null;
  // El logo ocupa solo su tamaño real: ancho limitado y alto según su proporción, sin huecos.
  const logoAspect = extras?.logoAspect || 3;
  const logoMaxW = wide ? 520 : Math.min(screenWidth, 520) * 0.82;
  const logoMaxH = wide ? 170 : 120;
  const logoW = Math.min(logoMaxW, logoMaxH * logoAspect);
  const posterW = wide ? 330 : Math.round(Math.min(screenWidth, 520) * 0.48);
  const tvStatus = isTv ? STATUS_TV[details.data.status] : null;
  const makers = extras?.makers ?? [];
  const nextUp = isTv && item ? nextEpisode(item) : null;

  const renderHero = (C: Colors, styles: ReturnType<typeof makeStyles>) => {
  // Título: el logo oficial cuando existe (como Bingebase); si no, texto grande.
  const titleBlock = logo ? (
    <Image
      source={{ uri: logo }}
      accessibilityLabel={title}
      style={{ width: logoW, height: logoW / logoAspect, maxWidth: '100%', alignSelf: wide ? 'flex-start' : 'center' }}
      contentFit="contain"
      contentPosition={wide ? 'left' : 'center'}
    />
  ) : (
    <T style={[styles.title, wide ? { fontSize: 46, lineHeight: 52 } : { textAlign: 'center' }]}>{title}</T>
  );

  const metaRow = (
    <View style={{ gap: 6, alignItems: wide ? 'flex-start' : 'center' }}>
      {!wide && genres ? (
        <T muted style={{ fontSize: 16 }}>
          {genres}
        </T>
      ) : null}
      <View style={[styles.metaLine, !wide && { justifyContent: 'center' }]}>
        <T muted style={styles.metaText}>
          {isTv ? meta[0] : year}
        </T>
        {extras?.certification ? (
          <View style={styles.cert}>
            <T style={{ fontSize: 12, fontWeight: '700', color: C.textMuted }}>{extras.certification}</T>
          </View>
        ) : null}
        {tvStatus ? <T style={[styles.metaText, { color: C.accentInk, fontWeight: '600' }]}>{tvStatus}</T> : null}
        {wide && extras?.networks[0] ? <T muted style={styles.metaText}>{extras.networks[0]}</T> : null}
      </View>
      <T muted style={[styles.metaText, !wide && { textAlign: 'center' }]}>
        {(isTv ? meta.slice(1, 4) : meta.slice(1, 2)).filter(Boolean).join(' · ')}
      </T>
      {makers.length ? (
        <T muted style={[styles.metaText, !wide && { textAlign: 'center' }]}>
          {isTv ? 'Creada por ' : 'Dirigida por '}
          <T style={[styles.metaText, { color: C.accentInk, fontWeight: '600' }]}>{makers.slice(0, 2).join(', ')}</T>
        </T>
      ) : null}
    </View>
  );

  const ratingBlock = (
    <View style={{ gap: Space.sm }}>
      <T style={styles.overline}>TU NOTA</T>
      <Rating
        compact
        value={item?.rating ?? null}
        onChange={(v) => {
          ensure(isTv ? 'watching' : 'completed');
          lib.setRating(key, v);
        }}
      />
    </View>
  );

  const scores = <ScoreRow tmdb={d.vote_average} votes={extras?.voteCount ?? 0} type={type} id={id} />;

  const actions = (
    <ActionTiles
      item={item}
      isTv={isTv}
      inLists={lib.lists.filter((l) => l.entries.some((e) => e.key === key)).length}
      onTrack={(e) => (item ? openBubble('status', e) : add(isTv ? 'watching' : 'planned'))}
      onFavorite={() => {
        ensure(isTv ? 'watching' : 'completed');
        lib.toggleFavorite(key);
      }}
      onLists={(e) => openSheet('lists', e)}
      onRate={(e) => openSheet('rate', e)}
      onMore={(e) => openBubble('more', e)}
    />
  );

  // "Estoy viendo T1 · E3" o "La vi": el atajo de lo siguiente que toca marcar.
  // Cuánto falta: episodios, porcentaje y horas, con una barra por temporada.
  const remaining =
    details.kind === 'tv' && item && !wide ? <ProgressSummary item={item} runtime={details.data.episode_run_time.find((x) => x > 0) ?? 0} /> : null;

  const watchRow = isTv ? (
    nextUp ? (
      <Touchable haptic="light" pressScale={0.98} onPress={() => openEpisode(nextUp)} style={styles.watchRow}>
        <View>
          <Icon name="clock" size={22} color={C.text} strokeWidth={2} />
        </View>
        <T style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>Sigue con {formatEpisode(nextUp.season, nextUp.episode)}</T>
        <View>
          <Icon name="chevronRight" size={18} color={C.textMuted} />
        </View>
      </Touchable>
    ) : null
  ) : (
    <Touchable haptic="light" pressScale={0.98} onPress={(e) => openSheet('watched', e)} style={styles.watchRow}>
      <View>
        <Icon name="check" size={22} color={item?.watchedAt ? C.accentInk : C.text} strokeWidth={2.4} />
      </View>
      <T style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>{item?.watchedAt ? 'La vi otra vez' : 'La vi'}</T>
      {item?.watchedAt ? (
        <T muted variant="small">
          {(item.rewatches?.length ?? 0) + 1}×
        </T>
      ) : null}
    </Touchable>
  );

  const overview = (
    <View style={{ gap: Space.sm }}>
      {d.tagline && !wide ? (
        <T muted style={{ fontStyle: 'italic' }}>
          {d.tagline}
        </T>
      ) : null}
      <Touchable haptic="select" pressScale={1} onPress={() => setOverviewOpen(!overviewOpen)}>
        <T style={styles.overview} numberOfLines={overviewOpen ? undefined : 4}>
          {d.overview || 'Sin sinopsis en español todavía.'}
        </T>
        {d.overview && d.overview.length > 240 ? (
          <T variant="label" style={{ marginTop: 4, color: C.accentInk }}>
            {overviewOpen ? 'Ver menos' : 'Ver más'}
          </T>
        ) : null}
      </Touchable>
    </View>
  );


    // Portada: la imagen completa detrás de todo el encabezado, oscurecida para que el texto se lea.
    const imageBox = wide
      ? StyleSheet.absoluteFill
      : ({ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(Math.min(screenWidth, 700) * 1.15) } as const);
    const scrim = (
      <>
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            style={imageBox}
            contentFit="cover"
            contentPosition="top"
            transition={250}
          />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(C.bg, 0), withAlpha(C.bg, 0.1), withAlpha(C.bg, C.mode === 'light' ? 0.86 : 0.78), C.bg]}
          locations={[0, 0.28, 0.6, 0.84]}
          style={imageBox}
        />
        {wide ? (
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(C.bg, 0.94), withAlpha(C.bg, 0.82), withAlpha(C.bg, 0.5), withAlpha(C.bg, 0.12)]}
            locations={[0, 0.38, 0.66, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </>
    );

    if (wide) {
      return (
        <View style={{ backgroundColor: C.bg }}>
          {scrim}
          <View style={[styles.content, styles.contentWide, { paddingTop: insets.top + 110, paddingBottom: Space.xxl }]}>
            <View style={{ flexDirection: 'row', gap: Space.xxl + Space.lg, alignItems: 'flex-end' }}>
              <View style={{ width: posterW, gap: Space.lg }}>
                <Poster path={poster} title={title} width={posterW} style={styles.poster} />
                {actions}
                {watchRow}
                {remaining}
              </View>
              <View style={{ flex: 1, gap: Space.xl, minWidth: 0, paddingBottom: Space.sm }}>
                <View style={{ gap: Space.md }}>
                  <T style={styles.overline}>{overline.toUpperCase()}</T>
                  {titleBlock}
                  {d.tagline ? <T style={{ fontSize: 22, lineHeight: 28, fontWeight: '600', color: C.text }}>{d.tagline}</T> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, flexWrap: 'wrap' }}>
                    {metaRow}
                    <RoundIcon icon="share" label="Compartir" onPress={share} />
                  </View>
                </View>
                {ratingBlock}
                {scores}
                {overview}
              </View>
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={{ backgroundColor: C.bg }}>
        {scrim}
        {/* Compartir arriba a la derecha, sobre la imagen; se va con ella al bajar. */}
        <View style={{ position: 'absolute', right: Gutter, top: insets.top + Space.sm, zIndex: 2 }}>
          <RoundIcon icon="share" label="Compartir" onPress={share} />
        </View>
        <View style={[styles.content, { paddingTop: insets.top + 64, paddingBottom: Space.xl, gap: Space.lg }]}>
          <View style={{ alignItems: 'center' }}>
            <Poster path={poster} title={title} width={posterW} style={styles.poster} />
          </View>
          <View style={{ gap: Space.md, alignItems: 'center', marginTop: Space.sm }}>
            {titleBlock}
            {metaRow}
          </View>
          {actions}
          {watchRow}
          {remaining}
          {ratingBlock}
          {scores}
          {overview}
        </View>
      </View>
    );
  };

  const tabs: [Tab, string][] = [
    ['info', 'Info'],
    ...(isTv ? ([['episodes', 'Episodios']] as [Tab, string][]) : []),
    ['cast', 'Reparto'],
    ['music', 'Música'],
    ['media', 'Videos'],
  ];

  const titles = [title, extras?.originalTitle ?? ''].filter((t, i, a) => t && a.indexOf(t) === i);
  const episodesPart =
    details.kind === 'tv' ? (
      <View style={{ gap: Space.xxl }}>
        {item ? <UpNext tv={details.data} item={item} wide={wide} onOpen={openEpisode} onNeedItem={() => ensure('watching')} /> : null}
        <SeasonsBlock tv={details.data} item={item} wide={wide} onNeedItem={() => ensure('watching')} onOpen={openEpisode} />
      </View>
    ) : null;
  const creditsPart = extras ? <Credits cast={extras.cast} crew={extras.crew} isTv={isTv} wide={wide} /> : <Loading />;
  const musicPart = <Soundtrack titles={titles} year={year ?? null} wide={wide} />;
  const mediaPart = extras ? <Gallery extras={extras} /> : <Loading />;
  const reactionsPart = item ? <Reactions value={item.reactions?.title ?? []} onChange={(list) => lib.setReactions(key, 'title', list)} /> : null;
  const wherePart = <WhereToWatch providers={providers} loaded={providersLoaded} />;
  const restPart = (
    <>
      {extras ? <DetailsBlock extras={extras} type={type} id={id} status={isTv ? details.data.status : undefined} /> : null}
      {details.kind === 'tv' ? <SeasonQuality seasons={details.data.seasons} /> : null}
      <InYourLists entryKey={key} />
      {item ? <NoteBox item={item} /> : null}
    </>
  );
  const sidePart = (
    <View style={{ gap: Space.xxl }}>
      {wherePart}
      {restPart}
    </View>
  );

  // Computador: dos columnas, como Trakt (a la izquierda dónde ver y detalles; a la derecha lo
  // que sigue, temporadas, episodios, reparto, música y videos). Celular: pestañas.
  const body = wide ? (
    <View style={{ gap: Space.xxl + Space.lg }}>
      <View style={{ flexDirection: 'row', gap: Space.xxl + Space.lg, alignItems: 'flex-start' }}>
        <View style={{ width: 340 }} nativeID="sec-info">
          {sidePart}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: Space.xxl + Space.lg }}>
          {episodesPart}
          {reactionsPart}
          <View nativeID="sec-cast">{creditsPart}</View>
          <View nativeID="sec-music">{musicPart}</View>
          {extras && (extras.videos.length || extras.backdrops.length) ? <View nativeID="sec-media">{mediaPart}</View> : null}
        </View>
      </View>
      {extras ? <Recommendations items={extras.recommendations} /> : null}
    </View>
  ) : (
    <View style={{ gap: Space.xl }}>
      <View style={styles.segment}>
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
              style={[styles.segmentBtn, on && styles.segmentOn]}>
              <T numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? C.text : C.textMuted }}>
                {label}
              </T>
            </Touchable>
          );
        })}
      </View>

      {tab === 'info' ? (
        <View style={{ gap: Space.xxl }}>
          {wherePart}
          {reactionsPart}
          {restPart}
        </View>
      ) : null}
      {tab === 'episodes' ? episodesPart : null}
      {tab === 'cast' ? creditsPart : null}
      {tab === 'music' ? musicPart : null}
      {tab === 'media' ? mediaPart : null}

      {extras ? <Recommendations items={extras.recommendations} /> : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <Backdrop />
      <FadeIn>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 96 }}>
        <DarkScope>
          <WithTheme>{renderHero}</WithTheme>
        </DarkScope>
        <View style={[styles.content, wide && styles.contentWide]}>{body}</View>
      </ScrollView>
      </FadeIn>


      {details.kind === 'tv' && wide ? (
        <EpisodePanel
          tv={details.data}
          target={episodeOpen}
          item={item}
          onClose={() => setEpisodeOpen(null)}
          onNeedItem={() => ensure('watching')}
          onNavigate={setEpisodeOpen}
        />
      ) : null}

      {/* Estado y Más: burbujas que salen del botón tocado. */}
      <BubbleMenu
        anchor={bubble?.kind === 'status' ? bubble.anchor : null}
        title="Estado"
        onClose={() => setBubble(null)}
        items={[
          ...STATUS_ORDER.map((st) => ({
            label: STATUS_LABEL[st],
            on: item?.status === st,
            onPress: () => (item ? lib.setStatus(key, st) : add(st)),
          })),
          ...(item?.mediaType === 'tv' && item.status === 'completed'
            ? ['divider' as const, { label: 'Volver a verla desde el principio', icon: 'history' as IconName, onPress: () => lib.restartShow(key) }]
            : []),
          ...(item ? ['divider' as const, { label: 'Quitar de mi lista', icon: 'trash' as IconName, danger: true, onPress: () => lib.remove(key) }] : []),
        ]}
      />

      <Sheet visible={sheet === 'rate'} anchor={sheetAnchor} onClose={() => setSheet(null)} title="¿Qué tal estuvo?" subtitle={title}>
        <Rating
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
          anchor={sheetAnchor}
          onClose={() => setSheet(null)}
          item={item}
          releaseDate={details.data.release_date}
          onEnsure={() => ensure('completed')}
          itemKey={key}
        />
      ) : null}

      <BubbleMenu
        anchor={bubble?.kind === 'more' ? bubble.anchor : null}
        onClose={() => setBubble(null)}
        items={[
          ...(extras?.trailerKey
            ? [{ label: 'Ver tráiler', icon: 'film' as IconName, onPress: () => Linking.openURL(`https://www.youtube.com/watch?v=${extras.trailerKey}`) }]
            : []),
          { label: 'Ver en TMDB', icon: 'screen' as IconName, onPress: () => Linking.openURL(`https://www.themoviedb.org/${type}/${id}`) },
          ...(extras?.imdbId
            ? [{ label: 'Ver en IMDb', icon: 'screen' as IconName, onPress: () => Linking.openURL(`https://www.imdb.com/title/${extras.imdbId}/`) }]
            : []),
          ...(item ? ['divider' as const, { label: 'Quitar de mi lista', icon: 'trash' as IconName, danger: true, onPress: () => lib.remove(key) }] : []),
        ]}
      />

      <AddToListSheet visible={sheet === 'lists'} anchor={sheetAnchor} entry={entry} onClose={() => setSheet(null)} />
    </View>
  );
}

// --- Notas ---

/** Sello pequeño de cada página, con sus colores. */
function Mark({ src }: { src: ExternalRating['source'] | 'tmdb' }) {
  const box = { height: 20, borderRadius: 5, paddingHorizontal: 5, alignItems: 'center' as const, justifyContent: 'center' as const };
  switch (src) {
    case 'imdb':
      return (
        <View style={[box, { backgroundColor: '#F5C518' }]}>
          <T style={{ fontSize: 11, fontWeight: '800', color: '#000' }}>IMDb</T>
        </View>
      );
    case 'tomatoes':
    case 'tomatoesaudience':
      return (
        <View style={[box, { backgroundColor: '#FA320A', borderRadius: 10, width: 20, paddingHorizontal: 0 }]}>
          <T style={{ fontSize: 11 }}>{src === 'tomatoes' ? '🍅' : '🍿'}</T>
        </View>
      );
    case 'metacritic':
      return (
        <View style={[box, { backgroundColor: '#000', borderWidth: 1.5, borderColor: '#FFCC34', borderRadius: 10, width: 20, paddingHorizontal: 0 }]}>
          <T style={{ fontSize: 11, fontWeight: '800', color: '#FFCC34' }}>m</T>
        </View>
      );
    case 'letterboxd':
      return (
        <View style={[box, { flexDirection: 'row', gap: 1.5, backgroundColor: '#14181C' }]}>
          {['#FF8000', '#00E054', '#40BCF4'].map((c) => (
            <View key={c} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
          ))}
        </View>
      );
    case 'trakt':
      return (
        <View style={[box, { backgroundColor: '#ED1C24', borderRadius: 10, width: 20, paddingHorizontal: 0 }]}>
          <T style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>t</T>
        </View>
      );
    default:
      return (
        <View style={[box, { backgroundColor: '#0D253F' }]}>
          <T style={{ fontSize: 10, fontWeight: '800', color: '#01B4E4' }}>TMDB</T>
        </View>
      );
  }
}

const RATING_NAME: Record<ExternalRating['source'], string> = {
  imdb: 'IMDb',
  tomatoes: 'Rotten Tomatoes',
  tomatoesaudience: 'Público RT',
  metacritic: 'Metacritic',
  letterboxd: 'Letterboxd',
  trakt: 'Trakt',
};

/**
 * Notas: IMDb, Rotten Tomatoes, Metacritic, Letterboxd, TMDB y Trakt, en ese orden (el de su
 * peso en el mundo). Las de otras páginas llegan si MDBList está configurado.
 */
function ScoreRow({ tmdb, votes, type, id }: { tmdb: number; votes: number; type: MediaType; id: number }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [ext, setExt] = useState<ExternalRating[]>([]);
  useEffect(() => {
    let off = false;
    getRatings(type, id).then((r) => !off && setExt(r));
    return () => {
      off = true;
    };
  }, [type, id]);
  const k = (n: number | null) => (n == null ? '' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} mil` : String(n));
  const cells: { mark: ExternalRating['source'] | 'tmdb'; value: string; of: string; label: string }[] = [];
  for (const r of ext) {
    if (r.source === 'trakt') continue;
    const pct = r.source === 'tomatoes' || r.source === 'tomatoesaudience';
    cells.push({
      mark: r.source,
      value: r.source === 'imdb' || r.source === 'letterboxd' ? String(r.value) : String(Math.round(r.value)),
      of: pct ? '%' : r.source === 'metacritic' ? '/100' : r.source === 'letterboxd' ? '/5' : '/10',
      label: r.votes ? `${k(r.votes)} votos` : RATING_NAME[r.source],
    });
  }
  if (tmdb > 0) cells.push({ mark: 'tmdb', value: tmdb.toFixed(1), of: '/10', label: votes ? `${k(votes)} votos` : 'TMDB' });
  const trakt = ext.find((r) => r.source === 'trakt');
  if (trakt) cells.push({ mark: 'trakt', value: String(Math.round(trakt.value)), of: '%', label: trakt.votes ? `${k(trakt.votes)} votos` : 'Trakt' });
  if (!cells.length) return null;
  return (
    <HScroll contentContainerStyle={{ gap: 0 }}>
      {cells.map((c, i) => (
        <View key={c.mark} style={[styles.score, { paddingRight: Space.lg }, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: Space.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Mark src={c.mark} />
            <T style={styles.scoreValue}>
              {c.value}
              <T style={styles.scoreOf}>{c.of}</T>
            </T>
          </View>
          <T variant="small" muted numberOfLines={1}>
            {c.label}
          </T>
        </View>
      ))}
    </HScroll>
  );
}

/** Botón redondo para compartir (sobre la imagen va con vidrio). */
/** Compartir: el mismo botón de vidrio que el de atrás. */
function RoundIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void; glass?: boolean }) {
  return <GlassButton icon={icon} label={label} onPress={onPress} />;
}

// --- Acciones ---

const TILE_STATUS: Record<WatchStatus, string> = {
  planned: 'Por ver',
  watching: 'Viendo',
  completed: 'Vista',
  paused: 'En pausa',
  dropped: 'Dejada',
};

/** Cinco botones cuadrados, como Bingebase: estado (con el color de la marca), Favorito, Listas, Calificar y Más. */
function ActionTiles({
  item,
  isTv,
  inLists,
  onTrack,
  onFavorite,
  onLists,
  onRate,
  onMore,
}: {
  item: LibraryItem | undefined;
  isTv: boolean;
  inLists: number;
  onTrack: (e?: PressLike) => void;
  onFavorite: () => void;
  onLists: (e?: PressLike) => void;
  onRate: (e?: PressLike) => void;
  onMore: (e?: PressLike) => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const statusIcon: IconName = !item ? 'plus' : item.status === 'watching' ? 'play' : item.status === 'completed' ? 'check' : item.status === 'planned' ? 'clock' : 'screen';
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm }}>
      <Touchable
        haptic="medium"
        pressScale={0.92}
        onPress={onTrack}
        accessibilityRole="button"
        accessibilityLabel={item ? TILE_STATUS[item.status] : isTv ? 'Seguir' : 'Por ver'}
        style={[styles.tile, { borderWidth: 0, overflow: 'hidden', boxShadow: 'none' }]}>
        <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View>
          <Icon name={statusIcon} size={24} color={C.onAccent} strokeWidth={1.8} />
        </View>
      </Touchable>
      <Tile icon="heart" label="Favorito" on={!!item?.favorite} onPress={onFavorite} />
      <Tile icon="ticket" label={inLists ? 'En listas' : 'Listas'} on={inLists > 0} onPress={onLists} />
      <Tile icon="edit" label="Calificar" on={!!item?.rating} onPress={onRate} />
      <Tile icon="more" label="Más" onPress={onMore} chevron />
    </View>
  );
}

function Tile({ icon, label, on, onPress, chevron }: { icon: IconName; label: string; on?: boolean; onPress: (e?: PressLike) => void; chevron?: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      onPress={onPress}
      haptic={icon === 'heart' ? 'medium' : 'light'}
      pressScale={0.92}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.tile, on && { backgroundColor: C.accentSoft }]}>
      <Icon name={icon} size={23} color={on ? C.accentInk : C.text} filled={on} strokeWidth={1.8} />
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
  anchor,
  onClose,
  item,
  releaseDate,
  onEnsure,
  itemKey: key,
}: {
  visible: boolean;
  anchor?: Anchor | null;
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
      anchor={anchor}
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
              placeholder={tr("2024-05-31")}
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
        placeholder={tr("Qué te pareció, quién te la recomendó…")}
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

// --- Dónde ver: todos los servicios, con lista desplegable ---

const KIND_LABEL = { flatrate: 'Streaming', free: 'Gratis', ads: 'Con anuncios', rent: 'Alquiler', buy: 'Compra' } as const;

/**
 * Dónde ver, como JustWatch: una cuadrícula de mosaicos con el logo grande de cada servicio y,
 * debajo, cómo se ve ahí (suscripción, alquiler, compra). Los que pagas van primero, marcados.
 */
function WhereToWatch({ providers, loaded }: { providers: TmdbWatchProviders | null; loaded: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { myProviders } = useSettings();
  const [open, setOpen] = useState(false);
  const mine = new Set(myProviders);

  // Un mosaico por servicio, con la mejor forma de verlo (suscripción antes que alquiler).
  const rows = useMemo(() => {
    const map = new Map<number, { id: number; name: string; logo: string | null; kind: string; order: number }>();
    (['flatrate', 'free', 'ads', 'rent', 'buy'] as const).forEach((k, ki) => {
      for (const p of providers?.[k] ?? []) {
        if (!map.has(p.provider_id)) map.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logo: p.logo_path || null, kind: KIND_LABEL[k], order: ki });
      }
    });
    return [...map.values()].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, myProviders]);

  const shown = open ? rows : rows.slice(0, 8);
  const link = providers?.link;

  return (
    <View style={{ gap: Space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <T variant="heading">Dónde ver</T>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="play" size={13} color="#F5C518" filled />
          <T style={{ fontSize: 13, fontWeight: '700', color: C.mode === 'light' ? '#9A7A00' : '#F5C518' }}>JustWatch</T>
        </View>
      </View>
      {!loaded ? (
        <Loading />
      ) : rows.length === 0 ? (
        <T variant="small" muted>
          Por ahora no aparece en ningún servicio de tu país.
        </T>
      ) : (
        <View style={styles.wtwGrid}>
          {shown.map((r) => {
            const isMine = mine.has(r.id);
            return (
              <Touchable
                key={r.id}
                haptic="light"
                pressScale={0.95}
                disabled={!link}
                onPress={() => link && Linking.openURL(link)}
                accessibilityLabel={`${r.name}, ${tr(r.kind)}`}
                style={styles.wtwTile}>
                <View style={{ height: 42, width: 84, alignItems: 'center', justifyContent: 'center' }}>
                  <ProviderWordmark id={r.id} name={r.name} logoPath={r.logo} />
                </View>
                <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '500', color: C.text }}>
                  {r.kind}
                </T>
                {isMine ? (
                  <View style={styles.wtwMine} accessibilityLabel={tr('En tu plan')}>
                    <Icon name="check" size={9} color={C.onAccent} strokeWidth={3.4} />
                  </View>
                ) : null}
              </Touchable>
            );
          })}
          {rows.length > 8 ? (
            <Touchable haptic="select" pressScale={0.95} onPress={() => setOpen(!open)} style={[styles.wtwTile, { justifyContent: 'center' }]}>
              <Icon name={open ? 'chevronUp' : 'plus'} size={22} color={C.text} strokeWidth={1.8} />
              <T style={{ fontSize: 13, fontWeight: '600', color: C.textMuted }}>{open ? 'Ver menos' : `+${rows.length - 8}`}</T>
            </Touchable>
          ) : null}
        </View>
      )}
      {loaded && myProviders.length === 0 ? (
        <Touchable onPress={() => router.navigate('/perfil')}>
          <T variant="caption" muted>
            Elige tus plataformas en Perfil para ver cuáles están en tu plan.
          </T>
        </Touchable>
      ) : null}
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: C.bg },
    content: { width: '100%', maxWidth: 1480, alignSelf: 'center', paddingHorizontal: Gutter },
    contentWide: { paddingHorizontal: Space.xxl + Space.md },
    poster: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      borderWidth: 1,
      borderColor: 'transparent',
    },
    overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: C.textMuted },
    title: { fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.8, color: C.text },
    overview: { fontSize: 16, lineHeight: 24, color: C.text },
    scores: { flexDirection: 'row', gap: Space.lg, flexWrap: 'wrap' },
    score: { gap: 2 },
    scoreValue: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: C.text },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
    // Sombra suave: el texto se lee aunque la imagen de fondo sea clara.
    metaText: { fontSize: 16, lineHeight: 22 },
    cert: { borderWidth: 1.5, borderColor: C.textFaint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tile: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      ...glassFill(C),
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    tileLabel: { fontSize: 11.5, fontWeight: '600' },
    tileChevron: { position: 'absolute', top: 6, right: 6 },
    watchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      height: 56,
      paddingHorizontal: Space.lg,
      borderRadius: 16,
      ...glassFill(C),
    },
    segment: { flexDirection: 'row', borderRadius: 999, padding: 4, ...glassFill(C) },
    segmentOn: { backgroundColor: C.mode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.14)', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' },
    segmentBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    seasonArt: {
      width: 120,
      aspectRatio: 2 / 3,
      borderRadius: Radius.md,
      overflow: 'hidden',
      backgroundColor: C.fill,
      borderWidth: 2,
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
    seasonBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      paddingVertical: Space.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: C.border,
    },
    epStill: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill },
    epTag: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(14,13,18,0.7)',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    epTime: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      backgroundColor: 'rgba(14,13,18,0.62)',
      borderRadius: Radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    providers: { ...glassFill(C), borderRadius: Radius.lg, paddingHorizontal: Space.md },
    wtwGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
    wtwTile: {
      width: 108,
      height: 108,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: C.mode === 'light' ? '#FFFFFF' : '#16161B',
      boxShadow: C.mode === 'light' ? '0 2px 10px rgba(30,16,50,0.06)' : 'none',
    },
    wtwMine: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md },
    planTag: { backgroundColor: C.accentSoft, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
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

