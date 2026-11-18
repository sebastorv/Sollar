/**
 * Ficha de una película o serie, con la estructura de Bingebase:
 * portada a lo ancho con la carátula encima, "Serie · En emisión", título grande, datos, notas,
 * acciones (Seguir, Favorito, Lista, Calificar, Más), dónde ver y pestañas Episodios · Reparto ·
 * Detalles. Sobria: tinta negra o blanca, sin degradados.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rating, RATING_LABELS, Reactions } from '@/components/rating';
import { Backdrop, card, Glass, glassFill, shadow } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { AddToListSheet, entryFrom } from '@/components/lists';
import { ProviderLogo } from '@/components/platforms';
import { Gallery } from '@/components/gallery';
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
import { DarkScope, useColors, useStyles } from '@/store/theme';

type Details = { kind: 'movie'; data: TmdbMovie } | { kind: 'tv'; data: TmdbTv };
type Tab = 'info' | 'episodes' | 'cast' | 'media';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** "12 mar 2024". */
function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = fromISO(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Fondo de la portada: siempre oscuro, para que las letras claras contrasten con la imagen. */
const HERO_BG = '#0B0B0D';

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

  const scores = <ScoreRow tmdb={d.vote_average} votes={extras?.voteCount ?? 0} item={item} isTv={isTv} />;

  const actions = (
    <ActionTiles
      item={item}
      isTv={isTv}
      inLists={lib.lists.filter((l) => l.entries.some((e) => e.key === key)).length}
      onTrack={() => (item ? setSheet('status') : add(isTv ? 'watching' : 'planned'))}
      onFavorite={() => {
        ensure(isTv ? 'watching' : 'completed');
        lib.toggleFavorite(key);
      }}
      onLists={() => setSheet('lists')}
      onRate={() => setSheet('rate')}
      onMore={() => setSheet('more')}
    />
  );

  // "Estoy viendo T1 · E3" o "La vi": el atajo de lo siguiente que toca marcar.
  // Cuánto falta: episodios, porcentaje y horas, con una barra por temporada.
  const remaining =
    details.kind === 'tv' && item ? <Remaining item={item} runtime={details.data.episode_run_time.find((x) => x > 0) ?? 0} /> : null;

  const watchRow = isTv ? (
    nextUp ? (
      <Touchable haptic="light" pressScale={0.98} onPress={() =>
          router.push({
            pathname: '/episodio/[id]/[temporada]/[episodio]',
            params: { id: String(id), temporada: String(nextUp.season), episodio: String(nextUp.episode) },
          })
        } style={styles.watchRow}>
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
    <Touchable haptic="light" pressScale={0.98} onPress={() => setSheet('watched')} style={styles.watchRow}>
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
          colors={['rgba(11,11,13,0.6)', 'rgba(11,11,13,0.25)', 'rgba(11,11,13,0.7)', HERO_BG]}
          locations={[0, 0.3, 0.72, 1]}
          style={imageBox}
        />
        {wide ? (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(11,11,13,0.94)', 'rgba(11,11,13,0.82)', 'rgba(11,11,13,0.5)', 'rgba(11,11,13,0.12)']}
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
        <View style={{ backgroundColor: HERO_BG, minHeight: Math.min(Math.round(screenWidth * 0.5625), 980) }}>
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
      <View style={{ backgroundColor: HERO_BG }}>
        {scrim}
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

    const tabs: [Tab, string][] = isTv
    ? [
        ['info', 'Info'],
        ['episodes', 'Episodios'],
        ['cast', 'Reparto'],
        ['media', 'Videos'],
      ]
    : [
        ['info', 'Info'],
        ['cast', 'Reparto'],
        ['media', 'Videos'],
      ];

  const body = (
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
              style={[styles.segmentBtn, on && { backgroundColor: C.surfaceHigh, ...shadow(C) }]}>
              <T numberOfLines={1} style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? C.text : C.textMuted }}>
                {label}
              </T>
            </Touchable>
          );
        })}
      </View>

      {tab === 'info' ? (
        <View style={{ gap: Space.xl }}>
          <WhereToWatch providers={providers} loaded={providersLoaded} />
          {item ? (
            <Reactions value={item.reactions?.title ?? []} onChange={(list) => lib.setReactions(key, 'title', list)} />
          ) : null}
          {extras ? <DetailsBlock extras={extras} type={type} id={id} status={isTv ? details.data.status : undefined} /> : null}
          {details.kind === 'tv' ? <SeasonQuality seasons={details.data.seasons} /> : null}
          {item ? <NoteBox item={item} /> : null}
        </View>
      ) : null}
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

      {tab === 'media' ? extras ? <Gallery extras={extras} /> : <Loading /> : null}

      <InYourLists entryKey={key} />
      {extras ? <Recommendations items={extras.recommendations} /> : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <Backdrop />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 96 }}>
        <DarkScope>
          <WithTheme>{renderHero}</WithTheme>
        </DarkScope>
        {/* Del fondo oscuro de la portada al fondo de la página. */}
        <LinearGradient colors={[HERO_BG, C.bg]} style={{ height: 56 }} />
        <View style={[styles.content, wide && styles.contentWide]}>{body}</View>
      </ScrollView>

      {/* Compartir arriba a la derecha, sobre la imagen (celular). */}
      {!wide ? (
        <View style={{ position: 'absolute', right: Space.lg, top: insets.top + (Platform.OS === 'web' ? 6 : 0) }}>
          <RoundIcon icon="share" label="Compartir" onPress={share} glass />
        </View>
      ) : null}

      <EpisodeSheet
        tvId={id}
        target={episodeOpen}
        item={item}
        onClose={() => setEpisodeOpen(null)}
        onNeedItem={() => ensure('watching')}
      />

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

function ScoreRow({ tmdb, votes, item, isTv }: { tmdb: number; votes: number; item: LibraryItem | undefined; isTv: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const seen = item && isTv ? watchedCount(item) : 0;
  const total = item && isTv ? totalEpisodes(item.seasons) : 0;
  const cells: { value: React.ReactNode; label: string; extra?: React.ReactNode }[] = [];
  if (tmdb > 0)
    cells.push({
      value: (
        <>
          {tmdb.toFixed(1)}
          <T style={styles.scoreOf}>/10</T>
        </>
      ),
      label: `TMDB${votes ? ` · ${votes >= 1000 ? `${(votes / 1000).toFixed(votes >= 10000 ? 0 : 1)} mil` : votes} votos` : ''}`,
    });
  // Tu nota ya se ve arriba, con los soles; aquí no se repite.
  if (!cells.length) return null;
  return (
    <View style={styles.scores}>
      {cells.map((c, i) => (
        <View key={i} style={[styles.score, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: Space.lg }]}>
          <T style={styles.scoreValue}>{c.value}</T>
          <T variant="small" muted numberOfLines={1}>
            {c.label}
          </T>
          {c.extra}
        </View>
      ))}
    </View>
  );
}

/** Botón redondo para compartir (sobre la imagen va con vidrio). */
function RoundIcon({ icon, label, onPress, glass }: { icon: IconName; label: string; onPress: () => void; glass?: boolean }) {
  const C = useColors();
  const inner = (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={C.text} strokeWidth={2.2} />
    </View>
  );
  return (
    <Touchable haptic="light" pressScale={0.88} onPress={onPress} accessibilityLabel={label} accessibilityRole="button">
      {glass ? (
        <Glass radius={999}>{inner}</Glass>
      ) : (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: C.border }}>{inner}</View>
      )}
    </Touchable>
  );
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
  onTrack: () => void;
  onFavorite: () => void;
  onLists: () => void;
  onRate: () => void;
  onMore: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const statusIcon: IconName = !item ? 'plus' : item.status === 'watching' ? 'play' : item.status === 'completed' ? 'check' : item.status === 'planned' ? 'clock' : 'screen';
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm }}>
      <Touchable haptic="medium" pressScale={0.94} onPress={onTrack} accessibilityRole="button" style={[styles.tile, { borderWidth: 0, overflow: 'hidden' }]}>
        <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View>
          <Icon name={statusIcon} size={24} color="#fff" filled={!!item} strokeWidth={2.4} />
        </View>
        <T numberOfLines={1} style={[styles.tileLabel, { color: '#fff', fontWeight: '700' }]}>
          {item ? TILE_STATUS[item.status] : isTv ? 'Seguir' : 'Por ver'}
        </T>
        {item ? (
          <View style={styles.tileChevron}>
            <Icon name="chevronDown" size={13} color="#fff" strokeWidth={2.6} />
          </View>
        ) : null}
      </Touchable>
      <Tile icon="heart" label="Favorito" on={!!item?.favorite} onPress={onFavorite} />
      <Tile icon="ticket" label={inLists ? 'En listas' : 'Listas'} on={inLists > 0} onPress={onLists} />
      <Tile icon="edit" label="Calificar" on={!!item?.rating} onPress={onRate} />
      <Tile icon="more" label="Más" onPress={onMore} chevron />
    </View>
  );
}

function Tile({ icon, label, on, onPress, chevron }: { icon: IconName; label: string; on?: boolean; onPress: () => void; chevron?: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      onPress={onPress}
      haptic={icon === 'heart' ? 'medium' : 'light'}
      pressScale={0.92}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.tile, on && { borderColor: C.accentLine, backgroundColor: C.accentSoft }]}>
      <View>
        <Icon name={icon} size={23} color={on ? C.accentInk : C.text} filled={on && icon === 'heart'} strokeWidth={2} />
      </View>
      <T numberOfLines={1} style={[styles.tileLabel, { color: on ? C.accentInk : C.textMuted }]}>
        {label}
      </T>
      {chevron ? (
        <View style={styles.tileChevron}>
          <Icon name="chevronDown" size={13} color={C.textMuted} strokeWidth={2.6} />
        </View>
      ) : null}
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
  const shelf = useRef<ScrollViewInstance>(null);

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
  const first = data?.episodes[0]?.air_date;
  const last = data?.episodes[data.episodes.length - 1]?.air_date;

  function toggle(ep: TmdbEpisode) {
    onNeedItem();
    lib.setEpisodes(key, [{ season, episode: ep.episode_number }], !seen(season, ep.episode_number));
  }
  function open(ep: { season: number; episode: number }) {
    router.push({
      pathname: '/episodio/[id]/[temporada]/[episodio]',
      params: { id: String(tv.id), temporada: String(ep.season), episodio: String(ep.episode) },
    });
  }

  let list = data?.episodes ?? [];
  if (hideWatched) list = list.filter((e) => !seen(season, e.episode_number));
  if (newest) list = [...list].reverse();
  const nextEp = next && next.season === season ? data?.episodes.find((e) => e.episode_number === next.episode) : null;
  const nextStill = nextEp ? sharpImage(nextEp.still_path, 'still', wide ? 260 : 140) : null;
  const cardW = wide ? 320 : 260;

  return (
    <View style={{ gap: Space.lg }}>
      {/* Lo que sigue: "Empieza desde" o "Sigue con". */}
      {nextEp && nextEp.air_date && nextEp.air_date <= today ? (
        <Touchable haptic="select" pressScale={0.98} onPress={() => open({ season, episode: nextEp.episode_number })} style={styles.nextCard}>
          <View style={[styles.nextStill, wide && { width: 220 }]}>
            {nextStill ? <Image source={{ uri: nextStill }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={{ flex: 1, gap: 2, justifyContent: 'center', minWidth: 0 }}>
            <T variant="caption" style={{ fontWeight: '700', letterSpacing: 0.6, color: C.accentInk }}>
              {(item && watchedCount(item) > 0 ? 'Sigue con' : 'Empieza desde').toUpperCase()}
            </T>
            <T style={{ fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {formatEpisode(season, nextEp.episode_number)} · {nextEp.name}
            </T>
            <T variant="caption" muted numberOfLines={1}>
              {[nextEp.runtime ? `${nextEp.runtime} min` : null, isDemo ? null : shortDate(nextEp.air_date)].filter(Boolean).join(' · ')}
            </T>
          </View>
          <CheckButton on={false} onPress={() => toggle(nextEp)} />
        </Touchable>
      ) : null}

      {/* Temporadas, con su carátula, avance y ✓ si está completa. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md, flexWrap: 'wrap' }}>
        <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>Temporadas</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Pill label={newest ? 'Recientes' : 'Antiguos'} icon={newest ? 'arrowDown' : 'arrowUp'} onPress={() => setNewest(!newest)} />
          <Pill label="Ocultar vistos" on={hideWatched} onPress={() => setHideWatched(!hideWatched)} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
        {seasons.map((s) => {
          const on = s.seasonNumber === season;
          const count = item
            ? Array.from({ length: s.episodeCount }, (_, i) => i + 1).filter((e) => seen(s.seasonNumber, e)).length
            : 0;
          const stub = tv.seasons.find((x) => x.season_number === s.seasonNumber);
          const art = sharpImage(stub?.poster_path ?? tv.poster_path, 'poster', 120);
          const done = count === s.episodeCount && count > 0;
          return (
            <Touchable
              key={s.seasonNumber}
              haptic="select"
              pressScale={0.95}
              onPress={() => {
                setSeason(s.seasonNumber);
                shelf.current?.scrollTo({ x: 0, animated: false });
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ width: 120, gap: 6 }}>
              <View style={[styles.seasonArt, on && { borderColor: C.accent }]}>
                {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                {done ? (
                  <View style={styles.doneBadge}>
                    <Icon name="check" size={13} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>
                Temporada {s.seasonNumber}{' '}
                <T style={{ fontSize: 14, color: C.textFaint, fontWeight: '500' }}>{stub?.air_date?.slice(0, 4) ?? ''}</T>
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.fill, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.round((count / s.episodeCount) * 100)}%`, backgroundColor: C.accent }} />
                </View>
                <T variant="caption" muted style={{ fontWeight: '700' }}>
                  {count}/{s.episodeCount}
                </T>
              </View>
            </Touchable>
          );
        })}
      </ScrollView>

      {/* Resumen de la temporada elegida. */}
      <View style={styles.seasonBar}>
        <T style={{ flex: 1, fontSize: 15 }} numberOfLines={2}>
          <T style={{ fontSize: 15, fontWeight: '700' }}>Temporada {season}</T>
          <T muted style={{ fontSize: 15 }}>
            {[
              !isDemo && first ? (last && last !== first ? `${shortDate(first)} a ${shortDate(last)}` : shortDate(first)) : null,
              data ? `${data.episodes.length} ep.` : null,
              seasonRuntime ? formatDuration(seasonRuntime) : null,
            ]
              .filter(Boolean)
              .map((x) => ` · ${x}`)
              .join('')}
          </T>
        </T>
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
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: aired.length ? 1 : 0.4 }}>
          <View>
            <Icon name="check" size={16} color={C.accentInk} strokeWidth={2.6} />
          </View>
          <T variant="label" style={{ color: C.accentInk }}>
            {allSeen ? 'Desmarcar' : 'Marcar temporada'}
          </T>
        </Touchable>
      </View>

      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      {!data && !error ? <Loading /> : null}

      {/* Episodios en fila horizontal: imagen, duración, ✓, título y un poco de sinopsis. */}
      <ScrollView ref={shelf} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.lg, paddingRight: Space.lg }}>
        {list.map((ep) => {
          const isSeen = seen(season, ep.episode_number);
          const upcoming = !ep.air_date || ep.air_date > today;
          const still = sharpImage(ep.still_path, 'still', cardW);
          const tag =
            ep.episode_type === 'finale' ? 'FINAL' : ep.episode_number === 1 ? 'ESTRENO' : ep.episode_type === 'mid_season' ? 'MITAD' : null;
          return (
            <Touchable
              key={ep.id}
              haptic="select"
              pressScale={0.97}
              onPress={() => open({ season, episode: ep.episode_number })}
              accessibilityRole="button"
              accessibilityLabel={`${formatEpisode(season, ep.episode_number)}, ${ep.name}`}
              style={{ width: cardW, gap: 6, opacity: upcoming ? 0.6 : 1 }}>
              <View style={styles.epStill}>
                {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                {tag ? (
                  <View style={styles.epTag}>
                    <T style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>{tag}</T>
                  </View>
                ) : null}
                {ep.runtime ? (
                  <View style={styles.epTime}>
                    <T style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{ep.runtime} min</T>
                  </View>
                ) : null}
                {!upcoming ? (
                  <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
                    <CheckButton on={isSeen} onPress={() => toggle(ep)} overlay />
                  </View>
                ) : null}
              </View>
              <T numberOfLines={1} style={{ fontSize: 16, fontWeight: '700' }}>
                {ep.name}
              </T>
              <T variant="caption" muted numberOfLines={1}>
                {[
                  formatEpisode(season, ep.episode_number),
                  upcoming ? (ep.air_date ? `Sale el ${shortDate(ep.air_date)}` : 'Por anunciar') : isDemo ? null : shortDate(ep.air_date),
                  ep.vote_average ? `★ ${ep.vote_average.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              {ep.overview ? (
                <T variant="small" muted numberOfLines={2}>
                  {ep.overview}
                </T>
              ) : null}
            </Touchable>
          );
        })}
        {data && list.length === 0 ? <T muted>Viste toda esta temporada.</T> : null}
      </ScrollView>
    </View>
  );
}

function CheckButton({ on, onPress, overlay }: { on: boolean; onPress: () => void; overlay?: boolean }) {
  const C = useColors();
  return (
    <Touchable
      haptic={on ? 'light' : 'success'}
      pressScale={0.85}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Desmarcar' : 'Marcar como visto'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? C.accent : overlay ? 'rgba(14,13,18,0.55)' : 'transparent',
        borderWidth: on ? 0 : 1.8,
        borderColor: overlay ? 'rgba(255,255,255,0.75)' : C.accentLine,
      }}>
      <View>
        <Icon name="check" size={18} color={on || overlay ? '#fff' : C.accentInk} strokeWidth={2.6} />
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

// --- Detalle de un episodio ---

function EpisodeSheet({
  tvId,
  target,
  item,
  onClose,
  onNeedItem,
}: {
  tvId: number;
  target: { season: number; episode: number } | null;
  item: LibraryItem | undefined;
  onClose: () => void;
  onNeedItem: () => void;
}) {
  const C = useColors();
  const lib = useLibrary();
  const [data, setData] = useState<TmdbSeason | null>(null);
  useEffect(() => {
    if (!target) return;
    let off = false;
    getSeason(tvId, target.season)
      .then((s) => !off && setData(s))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [tvId, target]);
  const ep = target && data?.season_number === target.season ? data.episodes.find((e) => e.episode_number === target.episode) : null;
  const key = itemKey('tv', tvId);
  const seen = target ? Boolean(item?.watchedEpisodes[episodeKey(target.season, target.episode)]) : false;
  const aired = !!ep?.air_date && ep.air_date <= todayISO();
  const still = ep ? sharpImage(ep.still_path, 'still', 520) : null;
  return (
    <Sheet visible={!!target} onClose={onClose}>
      {!ep || !target ? (
        <Loading />
      ) : (
        <View style={{ gap: Space.md }}>
          <View style={{ aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
            {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          </View>
          <T variant="small" style={{ color: C.accentInk, fontWeight: '700' }}>
            {[formatEpisode(target.season, target.episode), ep.runtime ? `${ep.runtime} min` : null, isDemo ? null : shortDate(ep.air_date)]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <T variant="heading">{ep.name}</T>
          <ScrollView style={{ maxHeight: 220 }}>
            <T muted style={{ fontSize: 15, lineHeight: 22 }}>
              {ep.overview || 'Sin sinopsis en español todavía.'}
            </T>
          </ScrollView>
          {aired ? (
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <Button
                label={seen ? 'Desmarcar' : 'Visto'}
                kind={seen ? 'secondary' : 'primary'}
                icon="check"
                style={{ flex: 1 }}
                onPress={() => {
                  onNeedItem();
                  lib.setEpisodes(key, [target], !seen);
                  onClose();
                }}
              />
              {!seen && target.episode > 1 ? (
                <Button
                  label="Hasta aquí"
                  kind="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    onNeedItem();
                    lib.setEpisodes(
                      key,
                      data!.episodes
                        .filter((e) => e.episode_number <= target.episode && e.air_date && e.air_date <= todayISO())
                        .map((e) => ({ season: target.season, episode: e.episode_number })),
                      true,
                    );
                    onClose();
                  }}
                />
              ) : null}
            </View>
          ) : (
            <T muted>{ep.air_date ? `Se estrena el ${shortDate(ep.air_date)}.` : 'Fecha por anunciar.'}</T>
          )}
        </View>
      )}
    </Sheet>
  );
}

// --- Dónde ver: todos los servicios, con lista desplegable ---

const KIND_LABEL = { flatrate: 'Suscripción', free: 'Gratis', ads: 'Gratis con anuncios', rent: 'Alquiler', buy: 'Compra' } as const;

function WhereToWatch({ providers, loaded }: { providers: TmdbWatchProviders | null; loaded: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { myProviders } = useSettings();
  const [open, setOpen] = useState(false);
  const mine = new Set(myProviders);

  // Un renglón por servicio, con todas sus formas de verlo (suscripción, alquiler, compra).
  const rows = useMemo(() => {
    const map = new Map<number, { id: number; name: string; logo: string | null; kinds: string[]; order: number }>();
    (['flatrate', 'free', 'ads', 'rent', 'buy'] as const).forEach((k, ki) => {
      for (const p of providers?.[k] ?? []) {
        const row = map.get(p.provider_id) ?? { id: p.provider_id, name: p.provider_name, logo: p.logo_path || null, kinds: [], order: ki };
        if (!row.kinds.includes(KIND_LABEL[k])) row.kinds.push(KIND_LABEL[k]);
        map.set(p.provider_id, row);
      }
    });
    return [...map.values()].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, myProviders]);

  const shown = open ? rows : rows.slice(0, 3);
  const inPlan = rows.filter((r) => mine.has(r.id) && (r.kinds.includes('Suscripción') || r.kinds[0]?.startsWith('Gratis')));

  return (
    <View style={{ gap: Space.md }}>
      <T variant="heading">Dónde ver</T>
      {!loaded ? (
        <Loading />
      ) : rows.length === 0 ? (
        <T variant="small" muted>
          Por ahora no aparece en ningún servicio de tu país.
        </T>
      ) : (
        <View style={styles.providers}>
          {shown.map((r, i) => {
            const isMine = mine.has(r.id);
            return (
              <Touchable
                key={r.id}
                haptic="light"
                pressScale={0.98}
                disabled={!providers?.link}
                onPress={() => providers?.link && Linking.openURL(providers.link)}
                style={[styles.providerRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                <ProviderLogo name={r.name} logoPath={r.logo} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={1} style={{ fontSize: 15, fontWeight: '600' }}>
                    {r.name}
                  </T>
                  <T variant="caption" muted numberOfLines={1}>
                    {r.kinds.join(' · ')}
                  </T>
                </View>
                {isMine ? (
                  <View style={styles.planTag}>
                    <T style={{ fontSize: 11, fontWeight: '700', color: C.accentInk }}>En tu plan</T>
                  </View>
                ) : null}
              </Touchable>
            );
          })}
          {rows.length > 3 ? (
            <Touchable
              haptic="select"
              onPress={() => setOpen(!open)}
              style={[styles.providerRow, { borderTopWidth: 1, borderTopColor: C.border, justifyContent: 'center' }]}>
              <T variant="label" style={{ color: C.accentInk }}>
                {open ? 'Ver menos' : `Ver todas las opciones (${rows.length})`}
              </T>
              <View>
                <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={C.accentInk} strokeWidth={2.4} />
              </View>
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
      ) : loaded && rows.length && !inPlan.length ? (
        <T variant="caption" muted>
          No está incluido en tus plataformas.
        </T>
      ) : null}
      <T variant="caption" style={{ color: C.textFaint }}>
        {isDemo ? 'Disponibilidad de ejemplo.' : 'Datos de JustWatch.'}
      </T>
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
    scores: { flexDirection: 'row', gap: Space.lg, flexWrap: 'wrap' },
    score: { gap: 2 },
    scoreValue: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: C.text },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
    // Sombra suave: el texto se lee aunque la imagen de fondo sea clara.
    metaText: { fontSize: 16, lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 8 },
    cert: { borderWidth: 1.5, borderColor: C.textFaint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tile: {
      flex: 1,
      height: 72,
      borderRadius: 16,
      borderWidth: 1,
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
      borderWidth: 1,
      ...glassFill(C),
    },
    segment: { flexDirection: 'row', borderRadius: 16, padding: 4, borderWidth: 1, ...glassFill(C) },
    segmentBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
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
    providers: { borderWidth: 1, ...glassFill(C), borderRadius: Radius.lg, paddingHorizontal: Space.md },
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

/** "13 de 23 · 57 % · faltan ~3 h", con una barra partida por temporada (como Bingebase). */
function Remaining({ item, runtime }: { item: LibraryItem; runtime: number }) {
  const C = useColors();
  const seasons = item.seasons.filter((s) => s.seasonNumber > 0 && s.episodeCount > 0);
  const total = totalEpisodes(seasons);
  if (!total) return null;
  const seenIn = (n: number) => Object.keys(item.watchedEpisodes).filter((k) => k.startsWith(`${n}:`)).length;
  const seen = seasons.reduce((a, s) => a + Math.min(seenIn(s.seasonNumber), s.episodeCount), 0);
  const left = total - seen;
  const pct = Math.round((seen / total) * 100);
  return (
    <View style={{ gap: Space.sm }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
        {seasons.map((s) => {
          const f = Math.min(seenIn(s.seasonNumber), s.episodeCount) / s.episodeCount;
          return (
            <View key={s.seasonNumber} style={{ flex: s.episodeCount, borderRadius: 4, overflow: 'hidden', backgroundColor: C.fill }}>
              <LinearGradient
                colors={[C.g1, C.g2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.round(f * 100)}%`, height: '100%' }}
              />
            </View>
          );
        })}
      </View>
      <T style={{ fontSize: 15, color: C.textMuted }}>
        <T style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{seen}</T> de {total} · {pct} %
        {left > 0
          ? ` · ${left === 1 ? 'falta 1 episodio' : `faltan ${left} episodios`}${runtime ? ` · ~${formatDuration(left * runtime)}` : ''}`
          : ' · ¡al día!'}
      </T>
    </View>
  );
}
