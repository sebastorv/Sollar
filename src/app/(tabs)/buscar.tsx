/** Pestaña "Buscar": búsqueda en TMDB y, sin texto, las tendencias de la semana. */

import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Grid, TitleCard } from '@/components/title-card';
import { useAvailabilityFor } from '@/hooks/use-availability';
import { availableLabel } from '@/lib/providers';
import { TokenWarning } from '@/components/token-warning';
import { Empty, Loading, Screen, Section, T } from '@/components/ui';
import { C, Radius, Space } from '@/constants/theme';
import { itemKey } from '@/lib/library-item';
import { displayTitle, displayYear, getTrending, isDemo, searchTitles } from '@/lib/tmdb';
import { STATUS_LABEL, type MediaType, type TmdbSearchResult } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { get } = useLibrary();
  const { myProviders } = useSettings();
  const availability = useAvailabilityFor(
    results.map((r) => ({ id: r.id, mediaType: r.media_type as MediaType })),
  );

  // Espera a que el usuario deje de escribir antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (debounced ? searchTitles(debounced) : getTrending())
      .then((r) => !cancelled && setResults(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <Screen>
      <T variant="title">Buscar</T>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={isDemo ? 'Prueba: dark, coco, the last of us' : 'Series y películas'}
        placeholderTextColor={C.textFaint}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Buscar series y películas"
      />

      {isDemo ? <TokenWarning /> : null}

      {error ? <Empty title="No se pudo buscar" message={error} /> : null}

      {loading && results.length === 0 ? <Loading /> : null}

      {!error && !loading && debounced && results.length === 0 ? (
        <Empty title="Sin resultados" message={`No encontramos nada para "${debounced}".`} />
      ) : null}

      {results.length > 0 ? (
        <Section title={debounced ? 'Resultados' : isDemo ? 'Catálogo de ejemplo' : 'Tendencias de la semana'}>
          <Grid>
            {results.map((r) => {
              const type = r.media_type as MediaType;
              const saved = get(itemKey(type, r.id));
              const kind = type === 'tv' ? 'Serie' : 'Película';
              const year = displayYear(r);
              return (
                <TitleCard
                  key={`${type}-${r.id}`}
                  id={r.id}
                  mediaType={type}
                  title={displayTitle(r)}
                  posterPath={r.poster_path}
                  subtitle={year ? `${kind} · ${year}` : kind}
                  badge={saved ? STATUS_LABEL[saved.status] : null}
                  highlight={availableLabel({ availability: availability[itemKey(type, r.id)] }, myProviders)}
                />
              );
            })}
          </Grid>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    color: C.text,
    fontSize: 16,
  },
});
