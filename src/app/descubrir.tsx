/** Filtros avanzados: combina tipo, géneros, época, nota mínima, duración y tus plataformas. */

import { HScroll } from '@/components/hscroll';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Grid, TitleCard } from '@/components/title-card';
import { Button, Chip, Empty, Loading, Screen, Section, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { itemKey } from '@/lib/library-item';
import { DEFAULT_DISCOVER, discover, getGenres, type DiscoverFilters } from '@/lib/tmdb';
import { STATUS_LABEL, type MediaType, type TmdbSearchResult } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

const ERAS: { label: string; from: number | null; to: number | null }[] = [
  { label: 'Cualquier año', from: null, to: null },
  { label: 'Este año', from: new Date().getFullYear(), to: new Date().getFullYear() },
  { label: '2020s', from: 2020, to: 2029 },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '90s', from: 1990, to: 1999 },
  { label: '80s', from: 1980, to: 1989 },
  { label: 'Clásicos', from: null, to: 1979 },
];
const RATINGS = [0, 6, 7, 8];
const SORTS: { key: DiscoverFilters['sort']; label: string }[] = [
  { key: 'popularity.desc', label: 'Populares' },
  { key: 'vote_average.desc', label: 'Mejor valoradas' },
  { key: 'primary_release_date.desc', label: 'Más recientes' },
];

export default function DiscoverScreen() {
  const { get } = useLibrary();
  const { myProviders } = useSettings();
  const [f, setF] = useState<DiscoverFilters>(DEFAULT_DISCOVER);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [results, setResults] = useState<TmdbSearchResult[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const set = (patch: Partial<DiscoverFilters>) => {
    setF((x) => ({ ...x, ...patch }));
    setPage(1);
  };

  useEffect(() => {
    getGenres(f.type).then(setGenres).catch(() => setGenres([]));
  }, [f.type]);

  useEffect(() => {
    let alive = true;
    if (page === 1) setResults(null);
    discover(f, page)
      .then((r) => {
        if (!alive) return;
        setPages(r.totalPages);
        setResults((prev) => (page === 1 ? r.results : [...(prev ?? []), ...r.results]));
      })
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [f, page]);

  const era = ERAS.findIndex((e) => e.from === f.fromYear && e.to === f.toYear);
  const runtimes = f.type === 'movie' ? [null, 100, 130] : [null, 30, 60];

  return (
    <Screen>
      <View style={{ paddingTop: 52, gap: Space.xs }}>
        <T variant="title">Descubrir</T>
        <T muted>Combina filtros para encontrar justo lo que quieres ver.</T>
      </View>

      <Row>
        <Chip label="Series" selected={f.type === 'tv'} onPress={() => set({ type: 'tv', genres: [], maxRuntime: null })} />
        <Chip label="Películas" selected={f.type === 'movie'} onPress={() => set({ type: 'movie', genres: [], maxRuntime: null })} />
        {myProviders.length ? (
          <Chip
            label="Solo en mis plataformas"
            selected={f.providers.length > 0}
            onPress={() => set({ providers: f.providers.length ? [] : myProviders })}
          />
        ) : null}
      </Row>

      <Section title="Géneros">
        <Row>
          {genres.map((g) => {
            const on = f.genres.includes(g.id);
            return (
              <Chip
                key={g.id}
                label={g.name}
                selected={on}
                onPress={() => set({ genres: on ? f.genres.filter((x) => x !== g.id) : [...f.genres, g.id] })}
              />
            );
          })}
        </Row>
      </Section>

      <Section title="Época">
        <Scroll>
          {ERAS.map((e, i) => (
            <Chip key={e.label} label={e.label} selected={era === i} onPress={() => set({ fromYear: e.from, toYear: e.to })} />
          ))}
        </Scroll>
      </Section>

      <Section title="Nota mínima en TMDB y duración">
        <Scroll>
          {RATINGS.map((r) => (
            <Chip key={r} label={r ? `${r}+` : 'Cualquier nota'} selected={f.minRating === r} onPress={() => set({ minRating: r })} />
          ))}
          {runtimes.map((m) => (
            <Chip
              key={String(m)}
              label={m == null ? 'Cualquier duración' : f.type === 'movie' ? `Hasta ${m} min` : `Episodios ≤ ${m} min`}
              selected={f.maxRuntime === m}
              onPress={() => set({ maxRuntime: m })}
            />
          ))}
        </Scroll>
      </Section>

      <Scroll>
        {SORTS.map((s) => (
          <Chip key={s.key} label={s.label} selected={f.sort === s.key} onPress={() => set({ sort: s.key })} />
        ))}
      </Scroll>

      {results == null ? (
        <Loading />
      ) : results.length === 0 ? (
        <Empty title="Nada con esa combinación" message="Prueba quitando algún filtro." />
      ) : (
        <>
          <Grid>
            {results.map((r) => {
              const type = r.media_type as MediaType;
              const saved = get(itemKey(type, r.id));
              const year = (r.release_date ?? r.first_air_date ?? '').slice(0, 4);
              return (
                <TitleCard
                  key={`${type}:${r.id}`}
                  id={r.id}
                  mediaType={type}
                  title={r.title ?? r.name ?? ''}
                  posterPath={r.poster_path}
                  subtitle={[year, r.vote_average ? `TMDB ${r.vote_average.toFixed(1)}` : null].filter(Boolean).join(' · ')}
                  badge={saved ? saved.status : null}
                />
              );
            })}
          </Grid>
          {page < pages ? <Button label="Cargar más" kind="secondary" onPress={() => setPage((p) => p + 1)} /> : null}
        </>
      )}
    </Screen>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>{children}</View>;
}

function Scroll({ children }: { children: React.ReactNode }) {
  return (
    <HScroll showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Space.sm }}>
      {children}
    </HScroll>
  );
}
