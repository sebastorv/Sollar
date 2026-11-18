/** Página de una persona del reparto: foto, datos, biografía y en qué ha trabajado. */

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Grid, TitleCard } from '@/components/title-card';
import { Touchable } from '@/components/touch';
import { Button, Empty, Loading, Screen, Section, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { longDate } from '@/lib/dates';
import { itemKey } from '@/lib/library-item';
import { getPerson, sharpImage, type Person } from '@/lib/tmdb';
import { STATUS_LABEL, type MediaType } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

const DEPARTMENT: Record<string, string> = {
  Acting: 'Actuación',
  Directing: 'Dirección',
  Writing: 'Guion',
  Production: 'Producción',
  Sound: 'Música y sonido',
  Camera: 'Fotografía',
  Editing: 'Edición',
  Creator: 'Creación',
};

function age(birthday: string, until?: string | null) {
  const b = new Date(birthday);
  const e = until ? new Date(until) : new Date();
  let a = e.getFullYear() - b.getFullYear();
  if (e.getMonth() < b.getMonth() || (e.getMonth() === b.getMonth() && e.getDate() < b.getDate())) a--;
  return a;
}

export default function PersonScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getPerson(Number(id))
      .then((p) => alive && setPerson(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <Screen>
        <Empty title="No se pudo cargar" message={error} action={<Button label="Volver" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (!person) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const photo = sharpImage(person.profilePath, 'poster', 132);
  const mine = person.credits.filter((c) => lib.get(itemKey(c.media_type as MediaType, c.id)));
  const facts = [
    person.department ? (DEPARTMENT[person.department] ?? person.department) : null,
    person.birthday
      ? `${longDate(person.birthday).replace(/^\S+ /, '')} de ${person.birthday.slice(0, 4)}${
          person.deathday ? '' : ` (${age(person.birthday)} años)`
        }`
      : null,
    person.placeOfBirth,
  ].filter(Boolean) as string[];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.photo}>
          {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        </View>
        <View style={{ flex: 1, gap: Space.xs, justifyContent: 'flex-end' }}>
          <T variant="title" style={{ fontSize: 28, lineHeight: 33 }}>
            {person.name}
          </T>
          {facts.map((f) => (
            <T key={f} variant="small" muted>
              {f}
            </T>
          ))}
        </View>
      </View>

      {person.biography ? (
        <Touchable onPress={() => setBioOpen(!bioOpen)} haptic={false} pressScale={1} accessibilityRole="button">
          <T numberOfLines={bioOpen ? undefined : 5}>{person.biography}</T>
          <T variant="label" style={{ color: C.accentInk, marginTop: Space.xs }}>
            {bioOpen ? 'Ver menos' : 'Leer más'}
          </T>
        </Touchable>
      ) : null}

      {mine.length ? (
        <Section title={`En tu lista (${mine.length})`}>
          <Grid>
            {mine.map((c) => {
              const it = lib.get(itemKey(c.media_type as MediaType, c.id))!;
              return (
                <TitleCard
                  key={`${c.media_type}:${c.id}`}
                  id={c.id}
                  mediaType={c.media_type as MediaType}
                  title={c.title ?? c.name ?? ''}
                  posterPath={c.poster_path}
                  subtitle={c.character || null}
                  highlight={STATUS_LABEL[it.status]}
                />
              );
            })}
          </Grid>
        </Section>
      ) : null}

      <Section title="Conocida por">
        <Grid>
          {person.credits
            .filter((c) => !lib.get(itemKey(c.media_type as MediaType, c.id)))
            .map((c) => (
              <TitleCard
                key={`${c.media_type}:${c.id}`}
                id={c.id}
                mediaType={c.media_type as MediaType}
                title={c.title ?? c.name ?? ''}
                posterPath={c.poster_path}
                subtitle={c.character || (c.release_date ?? c.first_air_date ?? '').slice(0, 4) || null}
              />
            ))}
        </Grid>
      </Section>
    </Screen>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', gap: Space.lg, paddingTop: 52 },
    photo: { width: 120, height: 160, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: C.fill },
  });
