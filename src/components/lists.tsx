/**
 * Listas propias: la vista de todas las listas, la portada de cada una y el panel para
 * agregar un título a varias listas a la vez.
 */

import { tr } from '@/i18n';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { sharpImage } from '@/lib/tmdb';
import type { CustomList, LibraryItem, ListEntry, MediaType } from '@/lib/types';
import { useLibrary } from '@/store/library';
import { useColors, useStyles } from '@/store/theme';

import { Glass, card } from './glass';
import { Icon } from './icons';
import { Sheet, type Anchor } from './sheet';
import { Touchable } from './touch';
import { Button, T } from './ui';

/** Id reservado para la lista automática de favoritos. */
export const FAVORITES_ID = 'favoritos';

export function entryFrom(x: {
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  year: string | null;
}): ListEntry {
  return {
    key: x.key,
    tmdbId: x.tmdbId,
    mediaType: x.mediaType,
    title: x.title,
    posterPath: x.posterPath,
    year: x.year,
    addedAt: new Date().toISOString(),
  };
}

/** Los favoritos se arman solos con los títulos marcados con corazón. */
export function favoritesList(items: LibraryItem[]): CustomList {
  const favs = items.filter((i) => i.favorite);
  return {
    id: FAVORITES_ID,
    name: 'Favoritos',
    description: 'Lo que marcaste con el corazón.',
    entries: favs.map((i) => ({ ...entryFrom(i), addedAt: i.updatedAt })),
    createdAt: '',
    updatedAt: '',
  };
}

/** Portada: cuatro carátulas en mosaico, o un degradado si la lista está vacía. */
export function ListCover({ list, size }: { list: CustomList; size: number }) {
  const C = useColors();
  const half = size / 2;
  const posters = list.entries.filter((e) => e.posterPath).slice(0, 4);
  return (
    <View style={{ width: size, height: size * 1.1, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
      {posters.length >= 4 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {posters.map((e) => (
            <Image
              key={e.key}
              source={{ uri: sharpImage(e.posterPath, 'poster', half) ?? undefined }}
              style={{ width: half, height: size * 0.55 }}
              contentFit="cover"
            />
          ))}
        </View>
      ) : posters[0] ? (
        <Image
          source={{ uri: sharpImage(posters[0].posterPath, 'poster', size) ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name={list.id === FAVORITES_ID ? 'heart' : 'ticket'} size={size / 3} color={C.textFaint} />
        </View>
      )}
    </View>
  );
}

/** Todas las listas: favoritos primero, luego las propias y el botón para crear una. */
export function MyLists() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const [creating, setCreating] = useState(false);
  const all = [favoritesList(lib.items), ...lib.lists];
  return (
    <View style={{ gap: Space.lg }}>
      <View style={styles.grid}>
        {all.map((l) => (
          <ListTile key={l.id} list={l} />
        ))}
        <Touchable style={[styles.tile, styles.newCard]} onPress={() => setCreating(true)} accessibilityLabel="Nueva lista">
          <View style={styles.plus}>
            <Icon name="plus" size={28} color={C.accentInk} strokeWidth={2.4} />
          </View>
          <View style={{ gap: 2, flex: 1 }}>
            <T style={{ fontSize: 18, fontWeight: '800', color: C.text }}>Nueva lista</T>
            <T variant="small" muted>
              Junta lo que quieras: maratones, pendientes, recomendaciones…
            </T>
          </View>
        </Touchable>
      </View>
      <ListNameDialog
        visible={creating}
        title="Nueva lista"
        onClose={() => setCreating(false)}
        onSave={(name, description) => {
          const id = lib.createList(name, description);
          setCreating(false);
          router.push({ pathname: '/lista/[id]', params: { id } });
        }}
      />
    </View>
  );
}

/**
 * Tarjeta de una lista: la primera carátula desenfocada de fondo, tres carátulas en abanico y
 * el nombre grande con cuántos títulos tiene y cuántos ya viste.
 */
function ListTile({ list }: { list: CustomList }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const posters = list.entries.filter((e) => e.posterPath).slice(0, 3);
  const seen = list.entries.filter((e) => {
    const it = lib.get(e.key);
    return it && (it.status === 'completed' || (it.mediaType === 'movie' && it.watchedAt));
  }).length;
  const total = list.entries.length;
  const bg = posters[0] ? sharpImage(posters[0].posterPath, 'poster', 200) : null;
  return (
    <Touchable
      haptic="light"
      pressScale={0.97}
      style={styles.tile}
      accessibilityLabel={`${list.name}, ${total} títulos`}
      onPress={() => router.push({ pathname: '/lista/[id]', params: { id: list.id } })}>
      {bg ? <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.mode === 'dark' ? 'rgba(11,11,13,0.62)' : 'rgba(255,255,255,0.7)' }]} />
      <View style={styles.fan}>
        {posters.length ? (
          posters
            .map((e, i) => (
              <Image
                key={e.key}
                source={{ uri: sharpImage(e.posterPath, 'poster', 90) ?? undefined }}
                style={[
                  styles.fanPoster,
                  {
                    left: i * 22,
                    zIndex: 3 - i,
                    transform: [{ rotate: `${(i - 1) * 7}deg` }, { scale: i === 0 ? 1 : 0.92 }],
                  },
                ]}
                contentFit="cover"
              />
            ))
            .reverse()
        ) : (
          <View style={[styles.fanPoster, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill }]}>
            <Icon name={list.id === FAVORITES_ID ? 'heart' : 'ticket'} size={30} color={C.textFaint} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {list.id === FAVORITES_ID ? (
            <View>
              <Icon name="heart" size={16} color={C.accent} filled />
            </View>
          ) : null}
          <T numberOfLines={2} style={{ fontSize: 19, lineHeight: 24, fontWeight: '800', color: C.text, flexShrink: 1 }}>
            {list.name}
          </T>
        </View>
        <T variant="small" muted>
          {total === 1 ? '1 título' : `${total.toLocaleString('es-CO')} títulos`}
          {total ? ` · ${seen} vistos` : ''}
        </T>
        {total ? (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: C.fill, overflow: 'hidden', marginTop: 4, maxWidth: 160 }}>
            <View style={{ width: `${Math.round((seen / total) * 100)}%`, height: '100%', backgroundColor: C.accent }} />
          </View>
        ) : null}
      </View>
      <View>
        <Icon name="chevronRight" size={18} color={C.textFaint} />
      </View>
    </Touchable>
  );
}

/** Diálogo para crear o renombrar una lista. */
export function ListNameDialog({
  visible,
  title,
  initialName = '',
  initialDescription = '',
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => {
      setName(initialName);
      setDescription(initialDescription);
    }}>
      <View style={styles.scrim}>
        <Glass strong radius={Radius.lg} style={styles.dialog}>
          <T variant="heading">{title}</T>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={tr("Nombre, por ejemplo: Para ver en vacaciones")}
            placeholderTextColor={C.textFaint}
            style={styles.input}
            autoFocus
            accessibilityLabel="Nombre de la lista"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={tr("Descripción (opcional)")}
            placeholderTextColor={C.textFaint}
            style={styles.input}
            accessibilityLabel="Descripción"
          />
          <View style={{ flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}>
            <Button label="Cancelar" kind="secondary" onPress={onClose} />
            <Button label="Guardar" disabled={!name.trim()} onPress={() => onSave(name.trim(), description.trim())} />
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

/** Panel para agregar o quitar un título de tus listas, con favoritos arriba. */
export function AddToListSheet({
  visible,
  entry,
  anchor,
  onClose,
}: {
  visible: boolean;
  entry: ListEntry;
  /** Botón que la abrió: la burbuja sale pegada a él. */
  anchor?: Anchor | null;
  onClose: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const lib = useLibrary();
  const [creating, setCreating] = useState(false);
  const item = lib.get(entry.key);
  return (
    <>
      <Sheet visible={visible && !creating} anchor={anchor} onClose={onClose} title="Guardar en">
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: Space.xs }}>
          <ToggleRow
            label="Favoritos"
            icon="heart"
            on={!!item?.favorite}
            disabled={!item}
            hint={item ? undefined : 'Agrégalo primero a tu lista'}
            onPress={() => lib.toggleFavorite(entry.key)}
          />
          {lib.lists.map((l) => {
            const on = l.entries.some((e) => e.key === entry.key);
            return (
              <ToggleRow
                key={l.id}
                label={l.name}
                icon="ticket"
                on={on}
                hint={`${l.entries.length} títulos`}
                onPress={() => (on ? lib.removeFromList(l.id, entry.key) : lib.addToList(l.id, entry))}
              />
            );
          })}
        </ScrollView>
        <Touchable onPress={() => setCreating(true)} style={styles.newRow} accessibilityRole="button">
          <Icon name="plus" size={20} color={C.accentInk} strokeWidth={2.4} />
          <T variant="label" style={{ color: C.accentInk }}>
            Nueva lista
          </T>
        </Touchable>
        <Button label="Listo" onPress={onClose} />
      </Sheet>
      <ListNameDialog
        visible={creating}
        title="Nueva lista"
        onClose={() => setCreating(false)}
        onSave={(name, description) => {
          // La lista nueva se crea con el título ya adentro.
          lib.createList(name, description, [entry]);
          setCreating(false);
        }}
      />
    </>
  );
}

function ToggleRow({
  label,
  icon,
  on,
  hint,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'heart' | 'ticket';
  on: boolean;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <Icon name={icon} size={20} color={on ? C.accentInk : C.textMuted} filled={on} />
      <View style={{ flex: 1 }}>
        <T variant="label" numberOfLines={1}>
          {label}
        </T>
        {hint ? (
          <T variant="caption" muted>
            {hint}
          </T>
        ) : null}
      </View>
      <View style={[styles.box, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
        {on ? <Icon name="check" size={14} color={C.onInk} strokeWidth={3} /> : null}
      </View>
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
    tile: {
      ...card(C),
      flexGrow: 1,
      flexBasis: 320,
      maxWidth: 560,
      minHeight: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.lg,
      padding: Space.lg,
      borderRadius: 24,
      overflow: 'hidden',
    },
    fan: { width: 118, height: 116 },
    fanPoster: { position: 'absolute', top: 4, width: 74, height: 110, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    listCard: { ...card(C), width: 164, padding: Space.md, gap: Space.sm, borderRadius: Radius.lg },
    newCard: { borderStyle: 'dashed', borderColor: C.accentLine, borderWidth: 1.5 },
    plus: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrim: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', padding: Space.lg },
    dialog: { padding: Space.xl, gap: Space.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
    sheet: {
      padding: Space.xl,
      gap: Space.md,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      marginBottom: -Space.lg,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingBottom: Space.xxl,
    },
    input: {
      backgroundColor: C.fill,
      borderRadius: Radius.md,
      paddingHorizontal: Space.md,
      paddingVertical: Space.md,
      fontSize: 16,
      color: C.text,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      paddingVertical: Space.sm,
      paddingHorizontal: Space.sm,
      borderRadius: Radius.md,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: C.textFaint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: Space.sm },
  });
