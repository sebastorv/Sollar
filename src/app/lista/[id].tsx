/** Una lista propia (o Favoritos): ver, ordenar, editar, renombrar y borrar. */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { FAVORITES_ID, ListNameDialog, favoritesList } from '@/components/lists';
import { Grid, TitleCard } from '@/components/title-card';
import { Touchable } from '@/components/touch';
import { Button, Chip, Empty, Poster, Screen, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import { STATUS_LABEL, type ListEntry } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

type Sort = 'manual' | 'recent' | 'title' | 'year' | 'rating';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'manual', label: 'Tu orden' },
  { key: 'recent', label: 'Recientes' },
  { key: 'title', label: 'Título' },
  { key: 'year', label: 'Año' },
  { key: 'rating', label: 'Tu nota' },
];
const PAGE = 60;

export default function ListScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const isFav = id === FAVORITES_ID;
  const list = isFav ? favoritesList(lib.items) : lib.lists.find((l) => l.id === id);
  const [sort, setSort] = useState<Sort>(isFav ? 'recent' : 'manual');
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => {
    if (!list) return [];
    const e = [...list.entries];
    const rating = (x: ListEntry) => lib.get(x.key)?.rating ?? -1;
    if (sort === 'recent') e.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    if (sort === 'title') e.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    if (sort === 'year') e.sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''));
    if (sort === 'rating') e.sort((a, b) => rating(b) - rating(a));
    return e;
  }, [list, sort, lib]);

  if (!list) {
    return (
      <Screen>
        <Empty title="Esta lista ya no existe" action={<Button label="Volver" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const seen = list.entries.filter((e) => {
    const it = lib.get(e.key);
    return it && (it.status === 'completed' || (it.mediaType === 'movie' && it.watchedAt));
  }).length;

  function pickRandom() {
    // Prefiere lo que aún no has visto.
    const pending = list!.entries.filter((e) => {
      const it = lib.get(e.key);
      return !(it && (it.status === 'completed' || (it.mediaType === 'movie' && it.watchedAt)));
    });
    const pool = pending.length ? pending : list!.entries;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    router.push({ pathname: '/titulo/[tipo]/[id]', params: { tipo: pick.mediaType, id: String(pick.tmdbId) } });
  }

  return (
    <Screen>
      <View style={{ paddingTop: Space.sm, gap: Space.xs }}>
        <T variant="title">{list.name}</T>
        {list.description ? <T muted>{list.description}</T> : null}
        <T variant="small" muted>
          {list.entries.length.toLocaleString('es-CO')} títulos · {seen.toLocaleString('es-CO')} vistos
        </T>
      </View>

      {isFav && list.entries.length > 1 ? (
        <View style={{ flexDirection: 'row' }}>
          <Button label="Elegir al azar" icon="sparkle" kind="secondary" onPress={pickRandom} />
        </View>
      ) : null}
      {!isFav ? (
        <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
          <Button
            label={editing ? 'Listo' : 'Editar'}
            kind={editing ? 'primary' : 'secondary'}
            onPress={() => {
              setEditing(!editing);
              if (!editing) setSort('manual');
            }}
          />
          <Button label="Renombrar" kind="secondary" onPress={() => setRenaming(true)} />
          {list.entries.length > 1 ? (
            <Button label="Elegir al azar" icon="sparkle" kind="secondary" onPress={pickRandom} />
          ) : null}
          <Button label="Borrar lista" kind="danger" onPress={() => setConfirmDelete(true)} />
        </View>
      ) : null}

      {confirmDelete ? (
        <View style={styles.confirm}>
          <T>¿Borrar "{list.name}"? Los títulos siguen en tu lista general; solo se borra esta lista.</T>
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            <Button
              label="Sí, borrar"
              kind="danger"
              onPress={() => {
                lib.deleteList(list.id);
                router.back();
              }}
            />
            <Button label="Cancelar" kind="secondary" onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      ) : null}

      {!editing ? (
        <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
          {SORTS.filter((s) => !(isFav && s.key === 'manual')).map((s) => (
            <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
          ))}
        </View>
      ) : (
        <T variant="small" muted>
          Usa las flechas para cambiar el orden y la papelera para sacar un título de esta lista.
        </T>
      )}

      {list.entries.length === 0 ? (
        <Empty
          title={isFav ? 'Aún no tienes favoritos' : 'Lista vacía'}
          message={
            isFav
              ? 'En la ficha de cualquier título toca el corazón.'
              : 'En la ficha de cualquier título toca "Listas" y elige esta.'
          }
          action={<Button label="Buscar títulos" onPress={() => router.navigate('/buscar')} />}
        />
      ) : editing ? (
        <View style={{ gap: Space.sm }}>
          {list.entries.map((e, i) => (
            <View key={e.key} style={styles.editRow}>
              <T variant="caption" muted style={{ width: 28, textAlign: 'right' }}>
                {i + 1}
              </T>
              <Poster path={e.posterPath} title={e.title} width={40} />
              <View style={{ flex: 1 }}>
                <T variant="label" numberOfLines={1}>
                  {e.title}
                </T>
                <T variant="caption" muted>
                  {e.mediaType === 'tv' ? 'Serie' : 'Película'}
                  {e.year ? ` · ${e.year}` : ''}
                </T>
              </View>
              <IconButton icon="arrowUp" label="Subir" disabled={i === 0} onPress={() => lib.moveInList(list.id, e.key, -1)} />
              <IconButton
                icon="arrowDown"
                label="Bajar"
                disabled={i === list.entries.length - 1}
                onPress={() => lib.moveInList(list.id, e.key, 1)}
              />
              <IconButton icon="trash" label="Quitar de la lista" danger onPress={() => lib.removeFromList(list.id, e.key)} />
            </View>
          ))}
        </View>
      ) : (
        <>
          <Grid>
            {sorted.slice(0, limit).map((e) => {
              const it = lib.get(e.key);
              return (
                <TitleCard
                  key={e.key}
                  id={e.tmdbId}
                  mediaType={e.mediaType}
                  title={e.title}
                  posterPath={it?.posterPath ?? e.posterPath}
                  subtitle={it?.rating ? `Tu nota: ${it.rating}/10` : e.year}
                />
              );
            })}
          </Grid>
          {sorted.length > limit ? (
            <Button
              label={`Mostrar más (${(sorted.length - limit).toLocaleString('es-CO')} restantes)`}
              kind="secondary"
              onPress={() => setLimit((l) => l + PAGE * 2)}
            />
          ) : null}
        </>
      )}

      <ListNameDialog
        visible={renaming}
        title="Renombrar lista"
        initialName={list.name}
        initialDescription={list.description}
        onClose={() => setRenaming(false)}
        onSave={(name, description) => {
          lib.updateList(list.id, { name, description });
          setRenaming(false);
        }}
      />
    </Screen>
  );

  function IconButton({
    icon,
    label,
    onPress,
    disabled,
    danger,
  }: {
    icon: 'arrowUp' | 'arrowDown' | 'trash';
    label: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
  }) {
    return (
      <Touchable
        onPress={onPress}
        disabled={disabled}
        haptic="select"
        accessibilityLabel={label}
        style={[styles.iconBtn, disabled && { opacity: 0.3 }]}>
        <Icon name={icon} size={18} color={danger ? C.danger : C.text} strokeWidth={2.2} />
      </Touchable>
    );
  }
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    confirm: { ...card(C), padding: Space.lg, gap: Space.md, borderRadius: Radius.lg, borderColor: C.danger },
    editRow: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      padding: Space.sm,
      borderRadius: Radius.md,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
