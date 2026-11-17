/** Panel de filtros de "Mi lista". */

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import {
  DEFAULT_FILTERS,
  LENGTH_LABEL,
  RATING_LABEL,
  SORT_LABEL,
  type Filters,
  type LengthFilter,
  type RatingFilter,
  type SortKey,
} from '@/lib/filters';
import type { ProviderInfo } from '@/lib/types';

import { Glass } from './glass';
import { Button, Chip, T } from './ui';

export function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
  genres,
  decades,
  myPlatforms,
  resultCount,
}: {
  visible: boolean;
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  genres: string[];
  decades: number[];
  myPlatforms: ProviderInfo[];
  resultCount: number;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const av = filters.availability;
  const isProvider = (id: number) => typeof av === 'object' && av.provider === id;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Glass strong radius={Radius.lg} style={styles.sheet}>
          <View style={styles.head}>
            <T variant="heading">Filtros</T>
            <Pressable onPress={() => onChange({ ...DEFAULT_FILTERS, status: filters.status, type: filters.type })}>
              <T variant="label" style={{ color: C.accentInk }}>
                Limpiar
              </T>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: Space.xl, paddingBottom: Space.lg }}>
            <Group title="Disponibilidad">
              <Chip label="Todas" selected={av === 'all'} onPress={() => set('availability', 'all')} />
              <Chip
                label="En mis plataformas"
                selected={av === 'mine'}
                onPress={() => set('availability', 'mine')}
              />
              <Chip
                label="Fuera de mis plataformas"
                selected={av === 'notMine'}
                onPress={() => set('availability', 'notMine')}
              />
              {myPlatforms.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={isProvider(p.id)}
                  onPress={() => set('availability', isProvider(p.id) ? 'all' : { provider: p.id })}
                />
              ))}
            </Group>
            {myPlatforms.length === 0 ? (
              <T variant="caption" muted style={{ marginTop: -Space.md }}>
                Elige tus plataformas en Perfil para filtrar por cada una.
              </T>
            ) : null}

            <Group title="Ordenar por">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <Chip key={k} label={SORT_LABEL[k]} selected={filters.sort === k} onPress={() => set('sort', k)} />
              ))}
            </Group>

            <Group title="Duración">
              {(['any', 'short', 'medium', 'long'] as LengthFilter[]).map((k) => (
                <Chip key={k} label={LENGTH_LABEL[k]} selected={filters.length === k} onPress={() => set('length', k)} />
              ))}
            </Group>
            <T variant="caption" muted style={{ marginTop: -Space.md }}>
              Películas: corta hasta 100 min, media hasta 140. Series, por episodio: corta hasta 30 min, media
              hasta 50.
            </T>

            <Group title="Tu calificación">
              {(['any', '8', '6', 'unrated'] as RatingFilter[]).map((k) => (
                <Chip key={k} label={RATING_LABEL[k]} selected={filters.rating === k} onPress={() => set('rating', k)} />
              ))}
            </Group>

            <Group title="Series">
              <Chip
                label="Solo con episodios pendientes"
                selected={filters.pendingOnly}
                onPress={() => set('pendingOnly', !filters.pendingOnly)}
              />
            </Group>

            {genres.length > 0 ? (
              <Group title="Géneros (cualquiera de los elegidos)">
                {genres.map((g) => {
                  const on = filters.genres.includes(g);
                  return (
                    <Chip
                      key={g}
                      label={g}
                      selected={on}
                      onPress={() =>
                        set('genres', on ? filters.genres.filter((x) => x !== g) : [...filters.genres, g])
                      }
                    />
                  );
                })}
              </Group>
            ) : null}

            {decades.length > 1 ? (
              <Group title="Década">
                <Chip label="Todas" selected={filters.decade == null} onPress={() => set('decade', null)} />
                {decades.map((d) => (
                  <Chip key={d} label={`${d}s`} selected={filters.decade === d} onPress={() => set('decade', d)} />
                ))}
              </Group>
            ) : null}
          </ScrollView>

          <Button
            label={resultCount === 1 ? 'Ver 1 título' : `Ver ${resultCount} títulos`}
            onPress={onClose}
          />
        </Glass>
      </View>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={{ gap: Space.sm }}>
      <T variant="label" muted>
        {title}
      </T>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    padding: Space.xl,
    gap: Space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
});
