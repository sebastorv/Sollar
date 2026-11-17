/** Pestaña "Mi lista": todos los títulos guardados, con filtros, atajos y orden. */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FilterSheet } from '@/components/filter-sheet';
import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { useProviderDirectory } from '@/components/platforms';
import { Grid, TitleCard } from '@/components/title-card';
import { Button, Chip, Empty, Screen, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { DEFAULT_FILTERS, activeCount, applyFilters, facets, remainingMinutes, type Filters } from '@/lib/filters';
import { formatDuration, formatEpisode, nextEpisode } from '@/lib/progress';
import { availabilityFrom, availableLabel, daysSince } from '@/lib/providers';
import { getWatchProviders } from '@/lib/tmdb';
import { STATUS_LABEL, STATUS_ORDER, type LibraryItem, type WatchStatus } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

/** Atajos: combinaciones de filtros que responden preguntas comunes. */
const PRESETS: { label: string; filters: Partial<Filters> }[] = [
  {
    label: 'Para esta noche',
    // Pendientes que ya puedes ver, empezando por lo más corto.
    filters: { status: 'planned', availability: 'mine', sort: 'remaining' },
  },
  { label: 'Listo en mis plataformas', filters: { availability: 'mine' } },
  { label: 'Maratón', filters: { type: 'tv', pendingOnly: true, availability: 'mine', sort: 'remaining' } },
  { label: 'Mis favoritas', filters: { rating: '8', sort: 'rating' } },
];

export default function ListScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const { items } = lib;
  const { myProviders } = useSettings();
  const { list: directory } = useProviderDirectory();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState<{ done: number; total: number } | null>(null);

  const filtered = useMemo(() => applyFilters(items, filters, myProviders), [items, filters, myProviders]);
  const { genres, decades } = useMemo(() => facets(items), [items]);
  const myPlatforms = (directory ?? []).filter((p) => myProviders.includes(p.id));
  const extra = activeCount(filters);

  const count = (s: WatchStatus) => items.filter((i) => i.status === s).length;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  // La revisión más antigua decide si conviene actualizar.
  const oldest = items.reduce<number | null>((max, i) => {
    const d = daysSince(i.availability?.checkedAt);
    if (d == null) return Infinity;
    return max == null ? d : Math.max(max, d);
  }, null);

  async function refreshAvailability() {
    const pending = items;
    setRefreshing({ done: 0, total: pending.length });
    for (let n = 0; n < pending.length; n++) {
      const it = pending[n];
      try {
        lib.setAvailability(it.key, availabilityFrom(await getWatchProviders(it.mediaType, it.tmdbId)));
      } catch {
        // Si falla uno, se sigue con los demás.
      }
      setRefreshing({ done: n + 1, total: pending.length });
    }
    setRefreshing(null);
  }

  return (
    <Screen>
      <T variant="title">Mi lista</T>

      {items.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={styles.hRow}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => setFilters({ ...DEFAULT_FILTERS, ...p.filters })}
              style={({ pressed }) => [styles.preset, pressed && { opacity: 0.75 }]}>
              <T variant="label" style={{ color: C.accentInk }}>
                {p.label}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hRow}>
        <Chip label={`Todo (${items.length})`} selected={filters.status === 'all'} onPress={() => set('status', 'all')} />
        {STATUS_ORDER.map((s) => (
          <Chip
            key={s}
            label={`${STATUS_LABEL[s]} (${count(s)})`}
            selected={filters.status === s}
            onPress={() => set('status', s)}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label="Todo" selected={filters.type === 'all'} onPress={() => set('type', 'all')} />
        <Chip label="Series" selected={filters.type === 'tv'} onPress={() => set('type', 'tv')} />
        <Chip label="Películas" selected={filters.type === 'movie'} onPress={() => set('type', 'movie')} />
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.filterBtn, extra > 0 && styles.filterBtnOn, pressed && { opacity: 0.75 }]}>
          <Icon name="filter" size={18} color={extra > 0 ? C.onAccent : C.text} strokeWidth={2} />
          <T variant="label" style={{ color: extra > 0 ? C.onAccent : C.text }}>
            {extra > 0 ? `Filtros · ${extra}` : 'Filtros'}
          </T>
        </Pressable>
        {extra > 0 || filters.status !== 'all' || filters.type !== 'all' ? (
          <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} accessibilityRole="button">
            <T variant="small" style={{ color: C.accentInk }}>
              Quitar todo
            </T>
          </Pressable>
        ) : null}
      </View>

      {items.length > 0 ? (
        <View style={styles.refreshRow}>
          <T variant="caption" muted style={{ flex: 1 }}>
            {refreshing
              ? `Revisando dónde ver… ${refreshing.done} de ${refreshing.total}`
              : oldest == null || oldest === Infinity
                ? 'Algunos títulos aún no tienen datos de dónde ver.'
                : oldest === 0
                  ? 'Disponibilidad revisada hoy.'
                  : `Disponibilidad revisada hace ${oldest} ${oldest === 1 ? 'día' : 'días'}.`}
          </T>
          <Pressable onPress={refreshAvailability} disabled={Boolean(refreshing)} accessibilityRole="button">
            <T variant="small" style={{ color: refreshing ? C.textFaint : C.accent, fontWeight: '600' }}>
              Revisar ahora
            </T>
          </Pressable>
        </View>
      ) : null}

      {filtered.length === 0 ? (
        <Empty
          title={items.length === 0 ? 'Aún no guardas nada' : 'Nada con estos filtros'}
          message={items.length === 0 ? 'Lo que agregues desde Buscar aparece aquí.' : 'Prueba quitando alguno.'}
          action={
            items.length === 0 ? (
              <Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} />
            ) : (
              <Button label="Quitar filtros" kind="secondary" onPress={() => setFilters(DEFAULT_FILTERS)} />
            )
          }
        />
      ) : (
        <>
          <T variant="small" muted>
            {filtered.length === 1 ? '1 título' : `${filtered.length} títulos`}
          </T>
          <Grid>
            {filtered.map((i) => (
              <TitleCard
                key={i.key}
                id={i.tmdbId}
                mediaType={i.mediaType}
                title={i.title}
                posterPath={i.posterPath}
                subtitle={subtitleFor(i, filters.sort)}
                highlight={availableLabel(i, myProviders)}
                badge={filters.status === 'all' ? STATUS_LABEL[i.status] : null}
              />
            ))}
          </Grid>
        </>
      )}

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setSheetOpen(false)}
        genres={genres}
        decades={decades}
        myPlatforms={myPlatforms}
        resultCount={filtered.length}
      />
    </Screen>
  );
}

function subtitleFor(i: LibraryItem, sort: Filters['sort']): string | null {
  if (sort === 'remaining') {
    const left = remainingMinutes(i);
    return left > 0 ? `Faltan ${formatDuration(left)}` : 'Terminada';
  }
  if (i.rating != null) return `★ ${i.rating}/10`;
  if (i.mediaType === 'tv' && i.status === 'watching') {
    const n = nextEpisode(i);
    return n ? `Sigue ${formatEpisode(n.season, n.episode)}` : 'Al día';
  }
  return i.year;
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  preset: {
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentSoft,
  },
  filterBtn: {
    ...card(C),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs + 2,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.pill,
  },
  filterBtnOn: { backgroundColor: C.g2, borderColor: C.g2 },
  // Sin esto, el carrusel horizontal estira las píldoras a lo alto.
  hScroll: { flexGrow: 0 },
  hRow: { gap: Space.sm, alignItems: 'center' },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
});
