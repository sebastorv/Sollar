/**
 * Descubrir: lo que aparece en Buscar antes de escribir. Recomendaciones "porque te gustó",
 * tendencias de hoy, lo popular en tus plataformas, lo más esperado y lo mejor valorado.
 */

import { HList } from './hscroll';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Gutter, Space, type Colors } from '@/constants/theme';
import { itemKey } from '@/lib/library-item';
import { DEFAULT_DISCOVER, discover, getExtras, getShelf, type Shelf } from '@/lib/tmdb';
import { STATUS_LABEL, type LibraryItem, type MediaType, type TmdbSearchResult } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useStyles } from '@/store/theme';

import { TitleCard } from './title-card';
import { Button, Chip, Section, T } from './ui';

type Kind = MediaType | 'all';

export function DiscoverHome() {
  const [kind, setKind] = useState<Kind>('all');
  const { myProviders } = useSettings();
  return (
    <View style={{ gap: Space.xl }}>
      <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label="Todo" selected={kind === 'all'} onPress={() => setKind('all')} />
        <Chip label="Series" selected={kind === 'tv'} onPress={() => setKind('tv')} />
        <Chip label="Películas" selected={kind === 'movie'} onPress={() => setKind('movie')} />
        <Button label="Filtros avanzados" kind="secondary" icon="filter" onPress={() => router.push('/descubrir')} />
      </View>
      <ForYou kind={kind} />
      <ShelfSection title="Tendencia hoy" load={() => getShelf('trending_day', kind)} deps={[kind]} />
      {myProviders.length ? (
        <ShelfSection
          title="Popular en tus plataformas"
          load={async () => {
            const types: MediaType[] = kind === 'all' ? ['tv', 'movie'] : [kind];
            const parts = await Promise.all(
              types.map((t) => discover({ ...DEFAULT_DISCOVER, type: t, providers: myProviders }).then((r) => r.results)),
            );
            return parts.flat().sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
          }}
          deps={[kind, myProviders.join(',')]}
        />
      ) : null}
      <ShelfSection title="Lo más esperado" load={() => getShelf('anticipated', kind)} deps={[kind]} />
      {kind !== 'movie' ? <ShelfSection title="Series en emisión" load={() => getShelf('on_air', 'tv')} deps={[]} /> : null}
      <ShelfSection title="Popular" load={() => getShelf('popular' as Shelf, kind)} deps={[kind]} />
      <ShelfSection title="Mejor valoradas" load={() => getShelf('top_rated', kind)} deps={[kind]} />
    </View>
  );
}

/** "Porque te encantó X": recomendaciones a partir de tus títulos mejor calificados y recientes. */
function ForYou({ kind }: { kind: Kind }) {
  const { items } = useLibrary();
  const seeds = useMemo(() => pickSeeds(items, kind), [items, kind]);
  return (
    <>
      {seeds.map((s) => (
        <ShelfSection
          key={s.key}
          title={`Porque te gustó ${s.title}`}
          subtitle={s.rating ? `Le pusiste ${s.rating}/10` : 'La estás viendo'}
          load={async () => (await getExtras(s.mediaType, s.tmdbId)).recommendations}
          deps={[s.key]}
          hideSaved
        />
      ))}
    </>
  );
}

function pickSeeds(items: LibraryItem[], kind: Kind): LibraryItem[] {
  const pool = items.filter((i) => (kind === 'all' || i.mediaType === kind) && ((i.rating ?? 0) >= 8 || i.status === 'watching'));
  // Primero lo mejor calificado de lo más reciente; luego lo que estás viendo.
  return pool
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
}

function ShelfSection({
  title,
  subtitle,
  load,
  deps,
  hideSaved,
}: {
  title: string;
  subtitle?: string;
  load: () => Promise<TmdbSearchResult[]>;
  deps: unknown[];
  /** No mostrar lo que ya está en tu lista (para recomendaciones). */
  hideSaved?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { get } = useLibrary();
  const [data, setData] = useState<TmdbSearchResult[] | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    load()
      .then((r) => alive && setData(r))
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const list = (data ?? []).filter((r) => !hideSaved || !get(itemKey(r.media_type as MediaType, r.id)));
  if (data && list.length === 0) return null;

  return (
    <Section title={title}>
      {subtitle ? (
        <T variant="small" muted style={{ marginTop: -Space.sm }}>
          {subtitle}
        </T>
      ) : null}
      {data == null ? (
        <View style={styles.placeholderRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.placeholder} />
          ))}
        </View>
      ) : (
        <HList
          data={list}
          keyExtractor={(r) => `${r.media_type}:${r.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Space.md }}
          style={styles.bleed}
          initialNumToRender={6}
          renderItem={({ item: r }) => {
            const type = r.media_type as MediaType;
            const saved = get(itemKey(type, r.id));
            const year = (r.release_date ?? r.first_air_date ?? '').slice(0, 4);
            return (
              <TitleCard
                id={r.id}
                mediaType={type}
                title={r.title ?? r.name ?? ''}
                posterPath={r.poster_path}
                subtitle={year || null}
                badge={saved ? saved.status : null}
                width={124}
              />
            );
          }}
        />
      )}
    </Section>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    bleed: { marginHorizontal: -Gutter, paddingHorizontal: Gutter, flexGrow: 0 },
    placeholderRow: { flexDirection: 'row', gap: Space.md },
    placeholder: { width: 124, height: 186, borderRadius: 14, backgroundColor: C.fill },
  });
