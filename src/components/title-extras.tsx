/**
 * Partes de la ficha completa: acciones rápidas (favorito, listas, tráiler, compartir),
 * reparto, calidad por temporada, detalles y "Si te gustó".
 */

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { sharpImage, type CastMember, type TitleExtras } from '@/lib/tmdb';
import type { ListEntry, MediaType, TmdbSearchResult, TmdbSeasonStub } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

import { card } from './glass';
import { Icon, type IconName } from './icons';
import { AddToListSheet } from './lists';
import { TitleCard } from './title-card';
import { Touchable } from './touch';
import { Section, T } from './ui';

/** Fila de botones redondos bajo el título. */
export function QuickActions({ entry, extras, title }: { entry: ListEntry; extras: TitleExtras | null; title: string }) {
  const C = useColors();
  const lib = useLibrary();
  const [sheet, setSheet] = useState(false);
  const item = lib.get(entry.key);
  const inLists = lib.lists.filter((l) => l.entries.some((e) => e.key === entry.key)).length;

  async function share() {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : `https://www.themoviedb.org/${entry.mediaType}/${entry.tmdbId}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url });
      } else {
        await Share.share({ message: `${title} ${url}` });
      }
    } catch {
      // Compartir cancelado.
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: Space.lg, flexWrap: 'wrap' }}>
      <Action
        icon="heart"
        label={item?.favorite ? 'Favorito' : 'Favorito'}
        on={!!item?.favorite}
        disabled={!item}
        onPress={() => lib.toggleFavorite(entry.key)}
      />
      <Action icon="ticket" label={inLists ? `En ${inLists} ${inLists === 1 ? 'lista' : 'listas'}` : 'Listas'} on={inLists > 0} onPress={() => setSheet(true)} />
      {extras?.trailerKey ? (
        <Action
          icon="film"
          label="Tráiler"
          onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${extras.trailerKey}`)}
        />
      ) : null}
      <Action icon="share" label="Compartir" onPress={share} />
      <AddToListSheet visible={sheet} entry={entry} onClose={() => setSheet(false)} />
    </View>
  );

  function Action({
    icon,
    label,
    on,
    disabled,
    onPress,
  }: {
    icon: IconName;
    label: string;
    on?: boolean;
    disabled?: boolean;
    onPress: () => void;
  }) {
    return (
      <Touchable
        onPress={onPress}
        disabled={disabled}
        haptic={icon === 'heart' ? 'medium' : 'light'}
        pressScale={0.88}
        accessibilityLabel={label}
        accessibilityState={{ selected: on, disabled }}
        style={{ alignItems: 'center', gap: 4, width: 64, opacity: disabled ? 0.4 : 1 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: on ? C.ink : C.fill,
          }}>
          <Icon name={icon} size={22} color={on ? C.onInk : C.text} filled={on} strokeWidth={2} />
        </View>
        <T variant="caption" numberOfLines={1} style={{ color: on ? C.text : C.textMuted, fontWeight: '600' }}>
          {label}
        </T>
      </Touchable>
    );
  }
}

/** Reparto en el mismo formato que las carátulas (2:3), con el nombre y el personaje debajo. */
export function CastShelf({ cast, title = 'Reparto' }: { cast: CastMember[]; title?: string }) {
  const C = useColors();
  if (!cast.length) return null;
  const W = 112;
  return (
    <Section title={title}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
        {cast.map((p) => {
          const uri = sharpImage(p.profilePath, 'poster', W);
          return (
            <Link key={p.id} href={{ pathname: '/persona/[id]', params: { id: String(p.id) } }} asChild>
              <Touchable style={{ width: W, gap: 6 }} accessibilityLabel={`${p.name}, ${p.character}`}>
                <View style={{ width: W, height: Math.round(W * 1.5), borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
                  {uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <T style={{ fontSize: 32, fontWeight: '800', color: C.textFaint }}>{p.name.charAt(0)}</T>
                    </View>
                  )}
                </View>
                <View>
                  <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>
                    {p.name}
                  </T>
                  <T variant="caption" muted numberOfLines={1} style={{ minHeight: 16 }}>
                    {p.character || ' '}
                  </T>
                </View>
              </Touchable>
            </Link>
          );
        })}
      </ScrollView>
    </Section>
  );
}

/** Calidad por temporada: barras con el promedio de TMDB, para ver qué temporada brilla. */
export function SeasonQuality({ seasons }: { seasons: TmdbSeasonStub[] }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const rated = seasons.filter((s) => s.season_number > 0 && (s.vote_average ?? 0) > 0);
  if (rated.length < 2) return null;
  const best = Math.max(...rated.map((s) => s.vote_average ?? 0));
  return (
    <Section title="Calidad por temporada">
      <View style={styles.chart}>
        {rated.map((s) => {
          const v = s.vote_average ?? 0;
          const h = Math.max(8, ((v - 4) / 6) * 100);
          const top = v === best;
          return (
            <View key={s.season_number} style={styles.barCol}>
              <T variant="caption" style={{ fontWeight: '700', color: top ? C.text : C.textMuted }}>
                {v.toFixed(1)}
              </T>
              <View style={[styles.bar, { height: h, backgroundColor: top ? C.ink : C.accentLine }]} />
              <T variant="caption" muted>
                T{s.season_number}
              </T>
            </View>
          );
        })}
      </View>
      <T variant="caption" muted>
        Promedio de votos en TMDB por temporada.
      </T>
    </Section>
  );
}

const LANG: Record<string, string> = {
  en: 'Inglés',
  es: 'Español',
  ko: 'Coreano',
  ja: 'Japonés',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  pt: 'Portugués',
  zh: 'Chino',
  hi: 'Hindi',
  tr: 'Turco',
  sv: 'Sueco',
  da: 'Danés',
  no: 'Noruego',
};

/** Tabla de detalles con separadores y enlaces a TMDB e IMDb. */
export function DetailsBlock({
  extras,
  type,
  id,
  status,
}: {
  extras: TitleExtras;
  type: MediaType;
  id: number;
  status?: string;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const rows: [string, string][] = [];
  if (extras.makers.length) rows.push([type === 'tv' ? 'Creada por' : 'Dirección', extras.makers.join(', ')]);
  if (extras.networks.length) rows.push(['Cadena', extras.networks.join(', ')]);
  if (status) rows.push(['Estado', STATUS_TV[status] ?? status]);
  if (extras.certification) rows.push(['Clasificación', extras.certification]);
  if (extras.originalTitle) rows.push(['Título original', extras.originalTitle]);
  if (extras.originalLanguage) rows.push(['Idioma original', LANG[extras.originalLanguage] ?? extras.originalLanguage.toUpperCase()]);
  if (!rows.length) return null;
  return (
    <Section title="Detalles">
      <View style={styles.table}>
        {rows.map(([k, v], i) => (
          <View key={k} style={[styles.tr, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
            <T variant="small" muted style={{ width: 130 }}>
              {k}
            </T>
            <T variant="small" style={{ flex: 1, fontWeight: '600' }}>
              {v}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: Space.lg }}>
        <Touchable onPress={() => Linking.openURL(`https://www.themoviedb.org/${type}/${id}`)} accessibilityRole="link">
          <T variant="label" style={{ textDecorationLine: 'underline' }}>
            Ver en TMDB
          </T>
        </Touchable>
        {extras.imdbId ? (
          <Touchable onPress={() => Linking.openURL(`https://www.imdb.com/title/${extras.imdbId}/`)} accessibilityRole="link">
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              Ver en IMDb
            </T>
          </Touchable>
        ) : null}
      </View>
    </Section>
  );
}

const STATUS_TV: Record<string, string> = {
  'Returning Series': 'En emisión',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'En producción',
  Planned: 'Anunciada',
  Pilot: 'Piloto',
  Released: 'Estrenada',
  'Post Production': 'Posproducción',
  Rumored: 'Rumor',
};

/** "Si te gustó": recomendaciones de TMDB a partir de este título. */
export function Recommendations({ items }: { items: TmdbSearchResult[] }) {
  if (!items.length) return null;
  return (
    <Section title="Si te gustó">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
        {items.map((r) => (
          <TitleCard
            key={`${r.media_type}:${r.id}`}
            id={r.id}
            mediaType={r.media_type as MediaType}
            title={r.title ?? r.name ?? ''}
            posterPath={r.poster_path}
            subtitle={(r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null}
            width={118}
          />
        ))}
      </ScrollView>
    </Section>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    chart: { ...card(C), flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, padding: Space.lg, borderRadius: Radius.lg, minHeight: 160 },
    barCol: { flex: 1, alignItems: 'center', gap: 4, minWidth: 22 },
    bar: { width: '70%', maxWidth: 28, borderRadius: 6 },
    table: { ...card(C), borderRadius: Radius.lg, paddingHorizontal: Space.lg },
    tr: { flexDirection: 'row', gap: Space.md, paddingVertical: Space.md },
  });
