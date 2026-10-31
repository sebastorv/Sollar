/** Pestaña "Mi lista": todos los títulos guardados, filtrados por estado y tipo. */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Grid, TitleCard } from '@/components/title-card';
import { Button, Chip, Empty, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { formatEpisode, nextEpisode } from '@/lib/progress';
import { STATUS_LABEL, STATUS_ORDER, type LibraryItem, type MediaType, type WatchStatus } from '@/lib/types';
import { useLibrary } from '@/store/library';

type TypeFilter = 'all' | MediaType;

export default function ListScreen() {
  const { items } = useLibrary();
  const [status, setStatus] = useState<WatchStatus | 'all'>('all');
  const [type, setType] = useState<TypeFilter>('all');

  const filtered = items.filter(
    (i) => (status === 'all' || i.status === status) && (type === 'all' || i.mediaType === type),
  );

  const count = (s: WatchStatus) => items.filter((i) => i.status === s).length;

  return (
    <Screen>
      <T variant="title">Mi lista</T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
        <Chip label={`Todo (${items.length})`} selected={status === 'all'} onPress={() => setStatus('all')} />
        {STATUS_ORDER.map((s) => (
          <Chip
            key={s}
            label={`${STATUS_LABEL[s]} (${count(s)})`}
            selected={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <Chip label="Todo" selected={type === 'all'} onPress={() => setType('all')} />
        <Chip label="Series" selected={type === 'tv'} onPress={() => setType('tv')} />
        <Chip label="Películas" selected={type === 'movie'} onPress={() => setType('movie')} />
      </View>

      {filtered.length === 0 ? (
        <Empty
          title={items.length === 0 ? 'Aún no guardas nada' : 'Nada con este filtro'}
          message={items.length === 0 ? 'Lo que agregues desde Buscar aparece aquí.' : undefined}
          action={
            items.length === 0 ? <Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} /> : null
          }
        />
      ) : (
        <Grid>
          {filtered.map((i) => (
            <TitleCard
              key={i.key}
              id={i.tmdbId}
              mediaType={i.mediaType}
              title={i.title}
              posterPath={i.posterPath}
              subtitle={subtitleFor(i)}
              badge={status === 'all' ? STATUS_LABEL[i.status] : null}
            />
          ))}
        </Grid>
      )}
    </Screen>
  );
}

function subtitleFor(i: LibraryItem): string | null {
  if (i.rating != null) return `★ ${i.rating}/10`;
  if (i.mediaType === 'tv' && i.status === 'watching') {
    const n = nextEpisode(i);
    return n ? `Sigue ${formatEpisode(n.season, n.episode)}` : 'Al día';
  }
  return i.year;
}
