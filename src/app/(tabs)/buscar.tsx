import { tr } from '@/i18n';
import { TypeFilter, type TypeValue } from '@/components/type-filter';
/** Pestaña "Buscar": búsqueda en TMDB y, sin texto, Descubrir (recomendaciones, tendencias y más). */

import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { Grid, TitleCard } from '@/components/title-card';
import { useAvailabilityFor } from '@/hooks/use-availability';
import { availableLabel } from '@/lib/providers';
import { TokenWarning } from '@/components/token-warning';
import { Empty, Loading, Screen, Section, T } from '@/components/ui';
import { DiscoverHome } from '@/components/discover';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { itemKey } from '@/lib/library-item';
import { displayTitle, displayYear, getTrending, isDemo, searchTitles } from '@/lib/tmdb';
import { STATUS_LABEL, type MediaType, type TmdbSearchResult } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

export default function SearchScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<TypeValue>('all');
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
    if (!debounced && !isDemo) {
      // Sin texto se muestra Descubrir, que carga lo suyo.
      setResults([]);
      setLoading(false);
      return;
    }
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
      <View style={styles.searchBox}>
        <Icon name="search" size={20} color={C.textMuted} />
        <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={tr(isDemo ? 'Prueba: dark, coco, the last of us' : 'Series y películas')}
        placeholderTextColor={C.textFaint}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Buscar series y películas"
      />
      </View>

      {debounced || isDemo ? <TypeFilter value={kind} onChange={setKind} /> : null}

      {isDemo ? <TokenWarning /> : null}

      {error ? <Empty title="No se pudo buscar" message={error} /> : null}

      {loading && results.length === 0 ? <Loading /> : null}

      {!error && !loading && debounced && results.length === 0 ? (
        <Empty title="Sin resultados" message={`No encontramos nada para "${debounced}".`} />
      ) : null}

      {!debounced && !isDemo ? <DiscoverHome /> : null}

      {results.length > 0 ? (
        <Section title={debounced ? 'Resultados' : isDemo ? 'Catálogo de ejemplo' : 'Tendencias de la semana'}>
          <Grid>
            {results.filter((r) => kind === 'all' || r.media_type === kind).map((r) => {
              const type = r.media_type as MediaType;
              const saved = get(itemKey(type, r.id));
              const year = displayYear(r);
              return (
                <TitleCard
                  key={`${type}-${r.id}`}
                  id={r.id}
                  mediaType={type}
                  title={displayTitle(r)}
                  posterPath={r.poster_path}
                  subtitle={year ?? null}
                  badge={saved ? saved.status : null}
                  availability={availability[itemKey(type, r.id)]}
                />
              );
            })}
          </Grid>
        </Section>
      ) : null}
    </Screen>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  searchBox: {
    ...card(C),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
  },
  input: {
    flex: 1,
    paddingVertical: Space.md + 2,
    color: C.text,
    fontSize: 16,
    // En web quita el contorno azul del navegador; el foco lo marca el borde de la caja.
    outlineStyle: 'none',
  } as object,
});
