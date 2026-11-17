/** Ficha de una película o serie: datos, estado, calificación, episodios y dónde verla. */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop, card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { ProviderLogo } from '@/components/platforms';
import { Button, Chip, Empty, Loading, Poster, ProgressBar, Section, T } from '@/components/ui';
import { PopcornRating } from '@/components/brand';
import { MaxContentWidth, Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { itemKey, newItemFromMovie, newItemFromTv, seasonsFromTv } from '@/lib/library-item';
import { formatEpisode, nextEpisode, progressOf, totalEpisodes, watchedCount } from '@/lib/progress';
import { availabilityFrom } from '@/lib/providers';
import { getMovie, getSeason, getTv, getWatchProviders, imageUrl, isDemo } from '@/lib/tmdb';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  episodeKey,
  type LibraryItem,
  type MediaType,
  type TmdbMovie,
  type TmdbSeason,
  type TmdbTv,
  type TmdbWatchProviders,
  type WatchStatus,
} from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

type Details = { kind: 'movie'; data: TmdbMovie } | { kind: 'tv'; data: TmdbTv };

export default function TitleScreen() {
  const C = useColors();
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

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const load =
      type === 'tv'
        ? getTv(id).then((data): Details => ({ kind: 'tv', data }))
        : getMovie(id).then((data): Details => ({ kind: 'movie', data }));
    load.then((d) => !cancelled && setDetails(d)).catch((e: Error) => !cancelled && setError(e.message));
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
    // lib cambia en cada render; basta con reaccionar a los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, savedSeasonsJson, key]);

  // Guarda dónde se puede ver, para que Mi lista filtre por plataforma sin conexión.
  const saved = Boolean(item);
  useEffect(() => {
    if (saved && providersLoaded) lib.setAvailability(key, availabilityFrom(providers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, providersLoaded, providers, key]);

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
  const title = details.kind === 'tv' ? details.data.name : details.data.title;
  const date = details.kind === 'tv' ? details.data.first_air_date : details.data.release_date;
  const meta = [
    date?.slice(0, 4),
    details.kind === 'tv'
      ? `${details.data.number_of_seasons} temp.`
      : details.data.runtime
        ? `${details.data.runtime} min`
        : null,
    d.genres.slice(0, 3).map((g) => g.name).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  function add(status: WatchStatus) {
    const created = details!.kind === 'tv' ? newItemFromTv(details!.data, status) : newItemFromMovie(details!.data, status);
    lib.save(providersLoaded ? { ...created, availability: availabilityFrom(providers) } : created);
  }

  const backdrop = imageUrl(d.backdrop_path, 'w780');

  return (
    <View style={styles.page}>
      <Backdrop />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={[styles.hero, !backdrop && { height: 200 }]}>
        {backdrop ? (
          <>
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {/* La imagen se funde con el fondo de la página. */}
            <LinearGradient
              colors={['transparent', C.mode === 'dark' ? 'rgba(14,13,18,0.5)' : 'rgba(247,246,249,0.4)', C.bg]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : null}
      </View>

      <SafeAreaView edges={['left', 'right']} style={styles.content}>
        <View style={styles.header}>
          <Poster path={d.poster_path} title={title} width={120} style={styles.headerPoster} />
          <View style={{ flex: 1, gap: Space.xs, justifyContent: 'flex-end' }}>
            <T variant="title" style={{ fontSize: 26, lineHeight: 31 }}>
              {title}
            </T>
            <T variant="small" muted>
              {meta}
            </T>
            {d.vote_average > 0 ? (
              <T variant="small" muted>
                TMDB {d.vote_average.toFixed(1)}/10
              </T>
            ) : null}
          </View>
        </View>

        {d.tagline ? (
          <T muted style={{ fontStyle: 'italic' }}>
            {d.tagline}
          </T>
        ) : null}
        {d.overview ? <T>{d.overview}</T> : <T muted>Sin sinopsis en español todavía.</T>}

        {/* Dónde ver va arriba: es lo primero que se quiere saber de un título. */}
        <WhereToWatch providers={providers} loaded={providersLoaded} />

        {item ? <SavedControls item={item} /> : <AddButtons kind={details.kind} onAdd={add} />}

        {details.kind === 'tv' ? <Seasons tv={details.data} item={item} /> : null}
      </SafeAreaView>
    </ScrollView>
    </View>
  );
}

function AddButtons({ kind, onAdd }: { kind: MediaType; onAdd: (s: WatchStatus) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
      <Button label="+ Quiero ver" onPress={() => onAdd('planned')} style={{ flexGrow: 1 }} />
      <Button
        label={kind === 'tv' ? 'Ya la estoy viendo' : 'Ya la vi'}
        kind="secondary"
        onPress={() => onAdd(kind === 'tv' ? 'watching' : 'completed')}
        style={{ flexGrow: 1 }}
      />
    </View>
  );
}

function SavedControls({ item }: { item: LibraryItem }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const [note, setNote] = useState(item.note);
  const next = item.mediaType === 'tv' ? nextEpisode(item) : null;

  return (
    <View style={styles.card}>
      <T variant="label">Estado</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {STATUS_ORDER.map((s) => (
          <Chip key={s} label={STATUS_LABEL[s]} selected={item.status === s} onPress={() => lib.setStatus(item.key, s)} />
        ))}
      </View>

      {item.mediaType === 'tv' ? (
        <View style={{ gap: Space.xs }}>
          <ProgressBar value={progressOf(item)} />
          <T variant="small" muted>
            {watchedCount(item)} de {totalEpisodes(item.seasons)} episodios
            {next ? ` · sigue ${formatEpisode(next.season, next.episode)}` : ' · al día'}
          </T>
        </View>
      ) : (
        <Button
          label={item.watchedAt ? 'Vista · tocar para desmarcar' : 'Marcar como vista'}
          icon="check"
          kind={item.watchedAt ? 'secondary' : 'primary'}
          onPress={() => lib.setMovieWatched(item.key, !item.watchedAt)}
        />
      )}

      <T variant="label">¿Qué tal estuvo?</T>
      <PopcornRating value={item.rating} onChange={(v) => lib.setRating(item.key, v)} />

      <T variant="label">Nota personal</T>
      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={() => note !== item.note && lib.setNote(item.key, note)}
        placeholder="Qué te pareció, quién te la recomendó…"
        placeholderTextColor={C.textFaint}
        multiline
        style={styles.note}
      />

      <Button
        label="Quitar de mi lista"
        kind="danger"
        onPress={() => lib.remove(item.key)}
      />
    </View>
  );
}

function Seasons({ tv, item }: { tv: TmdbTv; item: LibraryItem | undefined }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState<number | null>(null);
  const seasons = seasonsFromTv(tv);
  if (seasons.length === 0) return null;

  return (
    <Section title="Temporadas">
      <View style={{ gap: Space.sm }}>
        {seasons.map((s) => {
          const seen = item
            ? Array.from({ length: s.episodeCount }, (_, i) => i + 1).filter(
                (e) => item.watchedEpisodes[episodeKey(s.seasonNumber, e)],
              ).length
            : 0;
          const isOpen = open === s.seasonNumber;
          return (
            <View key={s.seasonNumber} style={styles.card}>
              <Pressable
                onPress={() => setOpen(isOpen ? null : s.seasonNumber)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}>
                <T variant="label">{s.name}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                  <T variant="small" muted>
                    {seen}/{s.episodeCount}
                  </T>
                  <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={18} color={C.textMuted} />
                </View>
              </Pressable>
              {isOpen ? <EpisodeList tvId={tv.id} season={s.seasonNumber} item={item} /> : null}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function EpisodeList({ tvId, season, item }: { tvId: number; season: number; item: LibraryItem | undefined }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const [data, setData] = useState<TmdbSeason | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSeason(tvId, season).then(setData).catch((e: Error) => setError(e.message));
  }, [tvId, season]);

  if (error) return <T variant="small" style={{ color: C.danger }}>{error}</T>;
  if (!data) return <Loading />;
  if (!item) {
    return (
      <T variant="small" muted>
        Agrega la serie a tu lista para marcar episodios.
      </T>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const aired = data.episodes.filter((e) => e.air_date && e.air_date <= today);
  const allSeen = aired.length > 0 && aired.every((e) => item.watchedEpisodes[episodeKey(season, e.episode_number)]);

  return (
    <View style={{ gap: Space.xs }}>
      <Button
        label={allSeen ? 'Desmarcar temporada' : 'Marcar temporada como vista'}
        kind="secondary"
        disabled={aired.length === 0}
        onPress={() =>
          lib.setEpisodes(
            item.key,
            aired.map((e) => ({ season, episode: e.episode_number })),
            !allSeen,
          )
        }
      />
      <T variant="caption" muted>
        Mantén presionado un episodio para marcar también todos los anteriores.
      </T>
      {data.episodes.map((ep) => {
        const seen = Boolean(item.watchedEpisodes[episodeKey(season, ep.episode_number)]);
        const upcoming = !ep.air_date || ep.air_date > today;
        return (
          <Pressable
            key={ep.id}
            disabled={upcoming}
            onPress={() => lib.setEpisodes(item.key, [{ season, episode: ep.episode_number }], !seen)}
            onLongPress={() =>
              lib.setEpisodes(
                item.key,
                data.episodes
                  .filter((e) => e.episode_number <= ep.episode_number && e.air_date && e.air_date <= today)
                  .map((e) => ({ season, episode: e.episode_number })),
                true,
              )
            }
            style={({ pressed }) => [styles.episode, pressed && { opacity: 0.7 }, upcoming && { opacity: 0.5 }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: seen, disabled: upcoming }}>
            <View style={[styles.checkbox, seen && styles.checkboxOn]}>
              {seen ? <Icon name="check" size={16} color={C.onAccent} strokeWidth={2.8} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T variant="small" numberOfLines={1} style={{ fontWeight: '600' }}>
                {ep.episode_number}. {ep.name}
              </T>
              <T variant="caption" muted>
                {upcoming ? `Se estrena ${ep.air_date ?? 'pronto'}` : isDemo ? '' : ep.air_date}
                {ep.runtime ? `${isDemo ? '' : ' · '}${ep.runtime} min` : ''}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function WhereToWatch({ providers, loaded }: { providers: TmdbWatchProviders | null; loaded: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { myProviders } = useSettings();
  const mine = new Set(myProviders);
  const groups: [string, TmdbWatchProviders['flatrate']][] = [
    ['Incluido en suscripción', providers?.flatrate],
    ['Gratis', [...(providers?.free ?? []), ...(providers?.ads ?? [])]],
    ['Alquiler', providers?.rent],
    ['Compra', providers?.buy],
  ];
  const any = groups.some(([, list]) => list && list.length > 0);
  const included = [...(providers?.flatrate ?? []), ...(providers?.free ?? []), ...(providers?.ads ?? [])];
  const matches = included.filter((p) => mine.has(p.provider_id));
  const matchNames = [...new Set(matches.map((p) => p.provider_name))];

  return (
    <Section title="Dónde ver">
      {!loaded ? (
        <Loading />
      ) : myProviders.length === 0 ? (
        <View style={styles.verdict}>
          <T variant="label">¿Qué plataformas pagas?</T>
          <T variant="small" muted>
            Elígelas en Perfil y aquí te diremos al instante si este título está incluido en tu plan.
          </T>
          <Button label="Elegir mis plataformas" kind="secondary" onPress={() => router.navigate('/perfil')} />
        </View>
      ) : matchNames.length > 0 ? (
        <View style={[styles.verdict, styles.verdictYes]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <Icon name="check" size={18} color={C.accentInk} strokeWidth={2.6} />
            <T variant="label" style={{ color: C.accentInk }}>
              Incluido en tu plan
            </T>
          </View>
          <T variant="small">Puedes verlo en {matchNames.join(', ')} sin pagar nada extra.</T>
        </View>
      ) : (
        <View style={styles.verdict}>
          <T variant="label">No está en tus plataformas</T>
          <T variant="small" muted>
            {any ? 'Abajo ves dónde sí está.' : 'Por ahora no aparece en ningún servicio de tu país.'}
          </T>
        </View>
      )}

      {loaded && any
        ? groups.map(([label, list]) =>
            list && list.length > 0 ? (
              <View key={label} style={{ gap: Space.sm }}>
                <T variant="small" muted>
                  {label}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                  {list.map((p) => (
                    <View
                      key={p.provider_id}
                      style={[styles.provider, mine.has(p.provider_id) && styles.providerMine]}>
                      <ProviderLogo name={p.provider_name} logoPath={p.logo_path || null} />
                      <T variant="caption" style={mine.has(p.provider_id) ? { fontWeight: '700' } : null}>
                        {p.provider_name}
                      </T>
                    </View>
                  ))}
                </View>
              </View>
            ) : null,
          )
        : null}

      <T variant="caption" muted>
        {isDemo ? 'Disponibilidad de ejemplo; puede no coincidir con la actual.' : 'Datos de JustWatch.'}
      </T>
    </Section>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  hero: { height: 280 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Space.lg,
    gap: Space.xl,
    marginTop: -90,
  },
  header: { flexDirection: 'row', gap: Space.lg, alignItems: 'flex-end' },
  headerPoster: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  card: {
    ...card(C),
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
  },
  note: {
    minHeight: 70,
    backgroundColor: C.fill,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: Space.md,
    color: C.text,
    textAlignVertical: 'top',
  },
  episode: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.g2, borderColor: C.g2 },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    ...card(C),
    padding: Space.xs,
    paddingRight: Space.md,
    borderRadius: Radius.pill,
  },
  providerMine: { borderColor: C.accentLine, backgroundColor: C.accentSoft },
  verdict: {
    ...card(C),
    gap: Space.sm,
    padding: Space.lg,
    borderRadius: Radius.lg,
  },
  verdictYes: { borderColor: C.accentLine, backgroundColor: C.accentSoft },
});
