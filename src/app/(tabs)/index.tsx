/** Pestaña "Siguiendo": lo que sale esta semana, el siguiente episodio de cada serie y lo pendiente. */

import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SollarLogo } from '@/components/brand';
import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { TitleCard } from '@/components/title-card';
import { TokenWarning } from '@/components/token-warning';
import { Button, Empty, Poster, ProgressBar, Screen, Section, T } from '@/components/ui';
import { useCalendar, type CalendarEpisode } from '@/hooks/use-calendar';
import { addDays, dayLabel, todayISO } from '@/lib/dates';
import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { formatEpisode, nextEpisode, progressOf, totalEpisodes, watchedCount } from '@/lib/progress';
import { availableLabel, myMatches } from '@/lib/providers';
import { isDemo } from '@/lib/tmdb';
import type { LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

export default function FollowingScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { items } = useLibrary();
  const watching = items.filter((i) => i.mediaType === 'tv' && i.status === 'watching');
  const plannedMovies = items.filter((i) => i.mediaType === 'movie' && i.status === 'planned');
  const plannedShows = items.filter((i) => i.mediaType === 'tv' && i.status === 'planned');
  const { myProviders } = useSettings();
  const calendar = useCalendar();
  const weekEnd = addDays(todayISO(), 6);
  const thisWeek = calendar.episodes.filter((e) => e.airDate <= weekEnd);
  // Pendientes que ya puedes ver con lo que pagas: lo más útil para decidir qué ver hoy.
  const readyNow = items.filter(
    (i) => (i.status === 'planned' || i.status === 'paused') && myMatches(i, myProviders).length > 0,
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <SollarLogo size={40} shape="icon" />
        <T variant="title">Siguiendo</T>
      </View>

      {isDemo ? <TokenWarning /> : null}

      {items.length === 0 ? (
        <Empty
          title="Aún no sigues nada"
          message="Busca una serie o película y agrégala a tu lista para empezar a llevar el seguimiento."
          action={<Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} />}
        />
      ) : null}

      {items.length > 0 && myProviders.length === 0 ? (
        <View style={styles.tip}>
          <T variant="label">¿Qué plataformas pagas?</T>
          <T variant="small" muted>
            Elígelas una vez y Sollar te muestra qué de tu lista puedes ver ya, sin pagar extra.
          </T>
          <Button label="Elegir mis plataformas" kind="secondary" onPress={() => router.navigate('/perfil')} />
        </View>
      ) : null}

      {thisWeek.length > 0 ? (
        <Section
          title="Esta semana"
          right={
            <Link href="/calendario" asChild>
              <Pressable hitSlop={8}>
                <T variant="label" style={{ color: C.accentInk }}>
                  Ver calendario
                </T>
              </Pressable>
            </Link>
          }>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
            {thisWeek.slice(0, 8).map((e) => (
              <WeekCard key={`${e.key}:${e.season}:${e.episode}`} e={e} />
            ))}
          </ScrollView>
        </Section>
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
              <NextEpisodeRow key={item.key} item={item} upcoming={calendar.nextByKey[item.key]} />
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

/** Tarjeta compacta de un episodio que sale esta semana. */
function WeekCard({ e }: { e: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: 'tv', id: String(e.tmdbId) } }} asChild>
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.week, pressed && { opacity: 0.8 }]}>
            <Poster path={e.posterPath} title={e.title} width={44} size="w185" />
            <View style={{ gap: 2, maxWidth: 150 }}>
              <T variant="caption" style={{ color: C.accentInk, fontWeight: '700' }}>
                {dayLabel(e.airDate)}
              </T>
              <T variant="label" numberOfLines={1}>
                {e.title}
              </T>
              <T variant="caption" muted>
                {formatEpisode(e.season, e.episode)}
              </T>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function NextEpisodeRow({ item, upcoming }: { item: LibraryItem; upcoming?: CalendarEpisode }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { setEpisodes } = useLibrary();
  const nextRaw = nextEpisode(item);
  // Si lo que sigue aún no ha salido, se avisa cuándo sale y no se puede marcar como visto.
  const unaired =
    !!nextRaw &&
    !!upcoming &&
    (nextRaw.season > upcoming.season || (nextRaw.season === upcoming.season && nextRaw.episode >= upcoming.episode));
  const next = unaired ? null : nextRaw;
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
            <T variant="small" style={{ color: C.accentInk }}>
              {next
                ? `Sigue: ${formatEpisode(next.season, next.episode)}`
                : unaired && upcoming
                  ? `${formatEpisode(upcoming.season, upcoming.episode)} sale ${dayLabel(upcoming.airDate).toLowerCase()}`
                  : 'Al día'}
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

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    tip: {
      ...card(C),
      gap: Space.sm,
      padding: Space.lg,
      borderRadius: Radius.lg,
    },
    row: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      padding: Space.md,
      borderRadius: Radius.lg,
    },
    week: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      padding: Space.sm,
      paddingRight: Space.md,
      borderRadius: Radius.lg,
    },
    check: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.g2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
