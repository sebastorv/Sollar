/** Historial: todo lo que has visto, día por día, del más reciente al más antiguo. */

import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { card } from '@/components/glass';
import { Touchable } from '@/components/touch';
import { TypeFilter } from '@/components/type-filter';
import { Button, Chip, Empty, Poster, Screen, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { eventsOf, hours, totalsOf, type WatchEvent } from '@/lib/activity';
import { dayLabel, longDate } from '@/lib/dates';
import { formatEpisode } from '@/lib/progress';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

type Filter = 'all' | 'tv' | 'movie';
const PAGE = 120;

export default function HistoryScreen() {
  const styles = useStyles(makeStyles);
  const { items } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const all = useMemo(() => eventsOf(items), [items]);
  const events = useMemo(() => (filter === 'all' ? all : all.filter((e) => e.mediaType === filter)), [all, filter]);
  const shown = events.slice(0, limit);

  const days = useMemo(() => {
    const groups: { day: string; events: WatchEvent[] }[] = [];
    for (const e of shown) {
      const last = groups[groups.length - 1];
      if (last?.day === e.day) last.events.push(e);
      else groups.push({ day: e.day, events: [e] });
    }
    return groups;
  }, [shown]);

  return (
    <Screen>
      <View style={{ paddingTop: Space.sm, gap: Space.xs }}>
        <T variant="title">Historial</T>
        <T muted>
          {events.length.toLocaleString('es-CO')} {events.length === 1 ? 'registro' : 'registros'} ·{' '}
          {hours(totalsOf(events).minutes)} frente a la pantalla
        </T>
      </View>
      <TypeFilter value={filter} onChange={(v) => (setFilter(v), setLimit(PAGE))} />

      {events.length === 0 ? (
        <Empty title="Aún no hay historial" message="Cada episodio y película que marques aparece aquí con su fecha." />
      ) : (
        days.map((g) => (
          <View key={g.day} style={{ gap: Space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space.sm }}>
              <T variant="heading">{dayLabel(g.day)}</T>
              <T variant="small" muted>
                {longDate(g.day)} · {g.events.length}
              </T>
            </View>
            <View style={styles.dayCard}>
              {g.events.map((e, i) => (
                <Row key={`${e.key}:${e.season}:${e.episode}:${e.at}`} e={e} first={i === 0} />
              ))}
            </View>
          </View>
        ))
      )}

      {events.length > limit ? (
        <Button label="Cargar más" kind="secondary" onPress={() => setLimit((l) => l + PAGE * 2)} />
      ) : null}
    </Screen>
  );
}

function Row({ e, first }: { e: WatchEvent; first: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const time = new Date(e.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return (
    <Link href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: e.mediaType, id: String(e.tmdbId) } }} asChild>
      <Touchable
        pressScale={0.98}
        style={StyleSheet.flatten([styles.row, !first && { borderTopWidth: 1, borderTopColor: C.border }])}>
        <Poster path={e.posterPath} title={e.title} width={40} />
        <View style={{ flex: 1 }}>
          <T variant="label" numberOfLines={1}>
            {e.title}
          </T>
          <T variant="caption" muted numberOfLines={1}>
            {e.mediaType === 'tv' && e.season ? formatEpisode(e.season, e.episode!) : e.rewatch ? 'Película · otra vez' : 'Película'}
          </T>
        </View>
        <T variant="caption" muted>
          {time}
        </T>
      </Touchable>
    </Link>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    dayCard: { ...card(C), borderRadius: Radius.lg, paddingHorizontal: Space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  });
