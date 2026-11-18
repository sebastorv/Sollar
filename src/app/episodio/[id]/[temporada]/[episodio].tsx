/**
 * Página de un episodio, a pantalla completa (como Bingebase): imagen del episodio de fondo,
 * ruta "Serie / Temporada 2 / Episodio 1 de 13", título grande, fecha, duración y cadena,
 * anterior / todos / siguiente, tu nota, la sinopsis, "¿Cómo te sentiste?", cuándo lo viste
 * (y cambiar la fecha), detalles y actores invitados.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateSheet, shortDate } from '@/components/date-sheet';
import { Backdrop, card } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { Rating, Reactions } from '@/components/rating';
import { CastShelf } from '@/components/title-extras';
import { Touchable } from '@/components/touch';
import { Button, Empty, Loading, Poster, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { withAlpha } from '@/constants/theme';
import { newItemFromTv } from '@/lib/library-item';
import { formatDuration, formatEpisode, totalEpisodes, watchedCount } from '@/lib/progress';
import { getSeason, getTv, isDemo, sharpImage } from '@/lib/tmdb';
import { STATUS_LABEL, episodeKey, type TmdbSeason, type TmdbTv } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { DarkScope, useColors, useStyles } from '@/store/theme';

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function when(iso: string) {
  const d = new Date(iso);
  return `${shortDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Toda la ficha va en modo oscuro, como Bingebase: la imagen de fondo y el texto se leen mejor. */
export default function EpisodeScreen() {
  return (
    <DarkScope>
      <EpisodeScreenBody />
    </DarkScope>
  );
}

function EpisodeScreenBody() {
  const p = useLocalSearchParams<{ id: string; temporada: string; episodio: string }>();
  const id = Number(p.id);
  const season = Number(p.temporada);
  const number = Number(p.episodio);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const insets = useSafeAreaInsets();
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const key = `tv:${id}`;
  const item = lib.get(key);

  const [tv, setTv] = useState<TmdbTv | null>(null);
  const [data, setData] = useState<TmdbSeason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateSheet, setDateSheet] = useState(false);

  useEffect(() => {
    let off = false;
    setError(null);
    Promise.all([getTv(id), getSeason(id, season)])
      .then(([t, s]) => {
        if (off) return;
        setTv(t);
        setData(s);
      })
      .catch((e: Error) => !off && setError(e.message));
    return () => {
      off = true;
    };
  }, [id, season]);

  if (error) {
    return (
      <View style={styles.page}>
        <Empty title="No se pudo cargar" message={error} action={<Button label="Volver" onPress={() => router.back()} />} />
      </View>
    );
  }
  if (!tv || !data) {
    return (
      <View style={styles.page}>
        <Loading />
      </View>
    );
  }
  const ep = data.episodes.find((e) => e.episode_number === number);
  if (!ep) {
    return (
      <View style={styles.page}>
        <Empty title="Episodio no encontrado" action={<Button label="Volver" onPress={() => router.back()} />} />
      </View>
    );
  }

  const ek = episodeKey(season, number);
  const watchedAt = item?.watchedEpisodes[ek] ?? null;
  const aired = !!ep.air_date && ep.air_date <= new Date().toISOString().slice(0, 10);
  const total = data.episodes.length;
  const tag = ep.episode_type === 'finale' ? 'Final de temporada' : number === 1 ? 'Estreno' : ep.episode_type === 'mid_season' ? 'Mitad de temporada' : null;
  const network = (tv as TmdbTv & { networks?: { name: string }[] }).networks?.[0]?.name;
  const still = sharpImage(ep.still_path ?? tv.backdrop_path, 'backdrop', width);
  const stillCard = sharpImage(ep.still_path, 'still', wide ? 380 : width);
  const directors = (ep.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
  const writers = (ep.crew ?? []).filter((c) => c.job === 'Writer' || c.job === 'Screenplay' || c.job === 'Teleplay').map((c) => c.name);
  const guests = (ep.guest_stars ?? []).slice(0, 20).map((g) => ({ id: g.id, name: g.name, character: g.character, profilePath: g.profile_path }));

  // Anterior y siguiente, también entre temporadas.
  const seasons = tv.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);
  const prevSeason = seasons.filter((s) => s.season_number < season).pop();
  const nextSeason = seasons.find((s) => s.season_number > season);
  const prev = number > 1 ? { s: season, e: number - 1 } : prevSeason ? { s: prevSeason.season_number, e: prevSeason.episode_count } : null;
  const next = number < total ? { s: season, e: number + 1 } : nextSeason ? { s: nextSeason.season_number, e: 1 } : null;
  const go = (t: { s: number; e: number }) =>
    router.replace({ pathname: '/episodio/[id]/[temporada]/[episodio]', params: { id: String(id), temporada: String(t.s), episodio: String(t.e) } });

  function ensure() {
    if (!lib.get(key)) lib.save(newItemFromTv(tv!, 'watching'));
  }
  function setWatched(on: boolean) {
    ensure();
    lib.setEpisodes(key, [{ season, episode: number }], on);
  }

  const date = ep.air_date ? new Date(ep.air_date + 'T12:00:00') : null;
  const meta = [
    date && !isDemo ? `${DAYS[date.getDay()]}, ${shortDate(ep.air_date)}` : null,
    ep.runtime ? formatDuration(ep.runtime) : null,
    network,
  ].filter(Boolean);

  const renderLeft = (C: Colors, styles: ReturnType<typeof makeStyles>) => (
    <View style={{ gap: Space.lg }}>
      <View style={styles.stillCard}>
        {stillCard ? <Image source={{ uri: stillCard }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <View style={styles.codeTag}>
          <T style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{formatEpisode(season, number)}</T>
        </View>
        {watchedAt ? (
          <View style={styles.seenDot}>
            <Icon name="check" size={18} color="#fff" strokeWidth={3} />
          </View>
        ) : null}
      </View>

      <Touchable
        haptic="select"
        pressScale={0.98}
        onPress={() => router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(id) } })}
        style={styles.showCard}>
        <Poster path={item?.posterPath ?? tv.poster_path} title={tv.name} width={64} />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <T numberOfLines={1} style={{ fontSize: 18, fontWeight: '800' }}>
            {tv.name}
          </T>
          <T variant="small" muted>
            Temporada {season} · Episodio {number} de {total}
          </T>
          {item ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <T variant="small" style={{ fontWeight: '600', color: C.accentInk }}>
                {STATUS_LABEL[item.status]}
              </T>
              <T variant="small" style={{ fontWeight: '700' }}>
                {watchedCount(item)}/{totalEpisodes(item.seasons)}
              </T>
            </View>
          ) : null}
        </View>
      </Touchable>

      {aired ? (
        <View style={{ gap: Space.md }}>
          {watchedAt ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
              <View>
                <Icon name="check" size={18} color={C.success} strokeWidth={2.6} />
              </View>
              <T>
                Lo viste el <T style={{ fontWeight: '700' }}>{when(watchedAt)}</T>
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            {watchedAt ? (
              <BigButton icon="close" title="Desmarcar" subtitle="Quitar de lo visto" onPress={() => setWatched(false)} />
            ) : (
              <BigButton icon="clock" title="Otro día" subtitle="Elegir la fecha" onPress={() => setDateSheet(true)} />
            )}
            <BigButton
              icon="check"
              title={watchedAt ? 'Visto' : 'Lo vi'}
              subtitle={watchedAt ? 'Cambiar fecha' : 'Marcar ahora'}
              primary
              onPress={() => (watchedAt ? setDateSheet(true) : setWatched(true))}
            />
          </View>
        </View>
      ) : (
        <T muted>{ep.air_date ? `Se estrena el ${shortDate(ep.air_date)}.` : 'Fecha de estreno por anunciar.'}</T>
      )}
    </View>
  );

  const renderRight = (C: Colors, styles: ReturnType<typeof makeStyles>) => (
    <View style={{ gap: Space.xl }}>
      <View style={{ gap: Space.md }}>
        <T style={styles.crumbs} numberOfLines={2}>
          {tv.name.toUpperCase()} <T style={styles.crumbSep}>/</T> {`TEMPORADA ${season}`} <T style={styles.crumbSep}>/</T> {`EPISODIO ${number} DE ${total}`}
        </T>
        <T style={[styles.title, wide && { fontSize: 56, lineHeight: 62 }]}>{ep.name}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' }}>
          <T muted style={{ fontSize: 16 }}>
            {meta.join(' · ')}
          </T>
          {tag ? <T style={{ fontSize: 16, fontWeight: '700', color: C.accentInk }}>{(meta.length ? '· ' : '') + tag}</T> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
          <NavButton icon="back" label={prev ? formatEpisode(prev.s, prev.e) : '—'} disabled={!prev} onPress={() => prev && go(prev)} />
          <NavButton
            label="Todos los episodios"
            onPress={() => router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(id) } })}
          />
          <NavButton icon="chevronRight" iconRight label={next ? formatEpisode(next.s, next.e) : '—'} disabled={!next} onPress={() => next && go(next)} />
        </View>
      </View>

      {aired ? (
        <View style={{ gap: Space.sm }}>
          <T style={styles.overline}>TU NOTA</T>
          <Rating
            compact
            prompt="¿Qué tal estuvo?"
            value={item?.episodeRatings?.[ek] ?? null}
            onChange={(v) => {
              ensure();
              lib.setEpisodeRating(key, ek, v);
            }}
          />
        </View>
      ) : null}

      {ep.vote_average ? (
        <View style={{ flexDirection: 'row', gap: Space.xl }}>
          <View>
            <T style={styles.score}>
              {ep.vote_average.toFixed(1)}
              <T style={styles.scoreOf}>/10</T>
            </T>
            <T variant="small" muted>
              TMDB
            </T>
          </View>
        </View>
      ) : null}

      <T style={{ fontSize: 18, lineHeight: 28, color: C.text }}>{ep.overview || 'Sin sinopsis en español todavía.'}</T>
    </View>
  );

  return (
    <View style={styles.page}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <DarkScope>
          <View style={{ backgroundColor: C.bg }}>
            {still ? (
              <Image
                source={{ uri: still }}
                style={wide ? StyleSheet.absoluteFill : { position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(width * 0.9) }}
                contentFit="cover"
                contentPosition="top"
              />
            ) : null}
            <LinearGradient
              colors={[withAlpha(C.bg, 0.6), withAlpha(C.bg, 0.45), withAlpha(C.bg, 0.75), C.bg]}
              locations={[0, 0.35, 0.75, 1]}
              style={wide ? StyleSheet.absoluteFill : { position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(width * 0.9) }}
            />
            <WithTheme>
              {(DC, ds) => (
                <View style={[ds.content, { paddingTop: insets.top + (wide ? 90 : 70), paddingBottom: Space.xl }]}>
                  {wide ? (
                    <View style={{ flexDirection: 'row', gap: Space.xxl + Space.md }}>
                      <View style={{ width: 380 }}>{renderLeft(DC, ds)}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>{renderRight(DC, ds)}</View>
                    </View>
                  ) : (
                    <View style={{ gap: Space.xl }}>
                      {renderRight(DC, ds)}
                      {renderLeft(DC, ds)}
                    </View>
                  )}
                </View>
              )}
            </WithTheme>
          </View>
        </DarkScope>
        <LinearGradient colors={[C.bg, C.bg]} style={{ height: 48 }} />
        <View style={[styles.content, { gap: Space.xxl }]}>
          {aired ? (
            <Reactions
              value={item?.reactions?.[ek] ?? []}
              onChange={(list) => {
                ensure();
                lib.setReactions(key, ek, list);
              }}
            />
          ) : null}
          {directors.length || writers.length || ep.air_date ? (
            <View style={{ gap: Space.md }}>
              <T variant="heading">Detalles</T>
              <View style={styles.table}>
                {[
                  ['Estreno', shortDate(ep.air_date)],
                  ['Duración', ep.runtime ? formatDuration(ep.runtime) : null],
                  ['Dirección', directors.join(', ')],
                  ['Guion', writers.join(', ')],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v], i) => (
                    <View key={k} style={[styles.tr, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                      <T muted style={{ width: 110 }}>
                        {k}
                      </T>
                      <T style={{ flex: 1, fontWeight: '600', textAlign: 'right' }}>{v}</T>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}
          {guests.length ? <CastShelf cast={guests} title="Invitados" /> : null}
        </View>
      </ScrollView>
      <DateSheet
        visible={dateSheet}
        onClose={() => setDateSheet(false)}
        title="¿Cuándo lo viste?"
        releaseDate={ep.air_date}
        onPick={(at) => {
          ensure();
          lib.setEpisodesAt(key, [{ season, episode: number }], at);
        }}
      />
    </View>
  );
}

function WithTheme({ children }: { children: (C: Colors, styles: ReturnType<typeof makeStyles>) => React.ReactNode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return <>{children(C, styles)}</>;
}

function BigButton({
  icon,
  title,
  subtitle,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const C = useColors();
  return (
    <Touchable
      haptic={primary ? 'success' : 'light'}
      pressScale={0.96}
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 16,
        padding: Space.md,
        gap: 4,
        overflow: 'hidden',
        borderWidth: primary ? 0 : 1,
        borderColor: C.border,
        backgroundColor: primary ? undefined : C.surface,
      }}>
      {primary ? <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Icon name={icon} size={20} color={primary ? '#fff' : C.text} strokeWidth={2.4} />
        <T style={{ fontSize: 17, fontWeight: '700', color: primary ? '#fff' : C.text }}>{title}</T>
      </View>
      <T variant="small" style={{ color: primary ? 'rgba(255,255,255,0.85)' : C.textMuted }}>
        {subtitle}
      </T>
    </Touchable>
  );
}

function NavButton({
  label,
  icon,
  iconRight,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  iconRight?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const C = useColors();
  const ic = icon ? (
    <View>
      <Icon name={icon} size={16} color={C.text} strokeWidth={2.4} />
    </View>
  ) : null;
  return (
    <Touchable
      haptic="select"
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 42,
        paddingHorizontal: Space.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: 'rgba(255,255,255,0.04)',
        opacity: disabled ? 0.35 : 1,
      }}>
      {!iconRight ? ic : null}
      <T style={{ fontSize: 15, fontWeight: '700' }}>{label}</T>
      {iconRight ? ic : null}
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: C.bg },
    content: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: Space.xl },
    stillCard: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: C.fill },
    codeTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(14,13,18,0.7)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
    seenDot: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    showCard: { ...card(C), flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.sm, borderRadius: Radius.lg },
    crumbs: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, color: C.text },
    crumbSep: { color: C.textFaint, fontSize: 13 },
    title: { fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.2, color: C.text },
    overline: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: C.textMuted },
    score: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: C.text },
    scoreOf: { fontSize: 13, color: C.textFaint, fontWeight: '600' },
    table: { ...card(C), borderRadius: Radius.lg, paddingHorizontal: Space.lg },
    tr: { flexDirection: 'row', gap: Space.md, paddingVertical: Space.md },
  });
