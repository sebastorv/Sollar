/** Pestaña "Siguiendo": el siguiente episodio de cada serie y las películas pendientes. */

import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { relief } from '@/components/glass';
import { Icon } from '@/components/icons';
import { TitleCard } from '@/components/title-card';
import { TokenWarning } from '@/components/token-warning';
import { Button, Empty, Poster, ProgressBar, Screen, Section, T } from '@/components/ui';
import { C, Radius, Space } from '@/constants/theme';
import { formatEpisode, nextEpisode, progressOf, totalEpisodes, watchedCount } from '@/lib/progress';
import { availableLabel, myMatches } from '@/lib/providers';
import { isDemo } from '@/lib/tmdb';
import type { LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

export default function FollowingScreen() {
  const { items } = useLibrary();
  const watching = items.filter((i) => i.mediaType === 'tv' && i.status === 'watching');
  const plannedMovies = items.filter((i) => i.mediaType === 'movie' && i.status === 'planned');
  const plannedShows = items.filter((i) => i.mediaType === 'tv' && i.status === 'planned');
  const { myProviders } = useSettings();
  // Pendientes que ya puedes ver con lo que pagas: lo más útil para decidir qué ver hoy.
  const readyNow = items.filter(
    (i) => (i.status === 'planned' || i.status === 'paused') && myMatches(i, myProviders).length > 0,
  );

  return (
    <Screen>
      <T variant="title">Siguiendo</T>

      {isDemo ? <TokenWarning /> : null}

      {items.length === 0 ? (
        <Empty
          title="Tu butaca está vacía"
          message="Busca una serie o película y agrégala a tu lista para empezar a llevar el seguimiento."
          action={<Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} />}
        />
      ) : null}

      {items.length > 0 && myProviders.length === 0 ? (
        <View style={styles.tip}>
          <T variant="label">¿Qué plataformas pagas?</T>
          <T variant="small" muted>
            Elígelas una vez y Butaca te muestra qué de tu lista puedes ver ya, sin pagar extra.
          </T>
          <Button label="Elegir mis plataformas" kind="secondary" onPress={() => router.navigate('/perfil')} />
        </View>
      ) : null}

      {readyNow.length > 0 ? (
        <Section title="Listo para ver en tus plataformas">
          <Shelf items={readyNow} myProviders={myProviders} />
        </Section>
      ) : null}

      {watching.length > 0 ? (
        <Section title="Continúa viendo">
          <View style={{ gap: Space.md }}>
            {watching.map((item) => (
              <NextEpisodeRow key={item.key} item={item} />
            ))}
          </View>
        </Section>
      ) : null}

      {plannedShows.length > 0 ? (
        <Section title="Series por empezar">
          <Shelf items={plannedShows} myProviders={myProviders} />
        </Section>
      ) : null}

      {plannedMovies.length > 0 ? (
        <Section title="Películas por ver">
          <Shelf items={plannedMovies} myProviders={myProviders} />
        </Section>
      ) : null}
    </Screen>
  );
}

function NextEpisodeRow({ item }: { item: LibraryItem }) {
  const { setEpisodes } = useLibrary();
  const next = nextEpisode(item);
  const total = totalEpisodes(item.seasons);

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(item.tmdbId) } }} asChild>
        <Pressable style={{ flexDirection: 'row', gap: Space.md, flex: 1 }}>
          <Poster path={item.posterPath} title={item.title} width={64} size="w185" />
          <View style={{ flex: 1, gap: Space.xs, justifyContent: 'center' }}>
            <T variant="label" numberOfLines={1}>
              {item.title}
            </T>
            <T variant="small" style={{ color: C.accent }}>
              {next ? `Sigue: ${formatEpisode(next.season, next.episode)}` : 'Al día'}
            </T>
            <ProgressBar value={progressOf(item)} />
            <T variant="caption" muted>
              {watchedCount(item)} de {total} episodios
            </T>
          </View>
        </Pressable>
      </Link>
      {next ? (
        <Pressable
          accessibilityLabel={`Marcar ${formatEpisode(next.season, next.episode)} como visto`}
          onPress={() => setEpisodes(item.key, [next], true)}
          style={({ pressed }) => [styles.check, pressed && { opacity: 0.7 }]}>
          <Icon name="check" size={24} color={C.onAccent} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Shelf({ items, myProviders }: { items: LibraryItem[]; myProviders: number[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
      {items.map((i) => (
        <TitleCard
          key={i.key}
          id={i.tmdbId}
          mediaType={i.mediaType}
          title={i.title}
          posterPath={i.posterPath}
          subtitle={i.year}
          highlight={availableLabel(i, myProviders)}
          width={110}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tip: {
    ...relief,
    gap: Space.sm,
    padding: Space.lg,
    borderRadius: Radius.lg,
  },
  row: {
    ...relief,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.lg,
  },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accent,
    borderWidth: 1,
    borderColor: '#F6E2B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
