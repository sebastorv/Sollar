/**
 * Banda sonora: los álbumes de la banda sonora del título (Apple Music) y sus canciones, con un
 * avance de 30 segundos que suena dentro de la app. Enlaces para abrirla en Apple Music,
 * Spotify o YouTube Music.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { useL } from '@/i18n';
import { Radius, Space, type Colors } from '@/constants/theme';
import { albumTracks, findSoundtracks, onPreviewChange, stopPreview, togglePreview, trackTime, type Album, type Track } from '@/lib/music';
import { isDemo } from '@/lib/tmdb';
import { useColors, useStyles } from '@/store/theme';

import { glassFill } from './glass';
import { HScroll } from './hscroll';
import { Icon } from './icons';
import { Touchable } from './touch';
import { Loading, T } from './ui';

export function Soundtrack({ titles, year, wide }: { titles: string[]; year: string | null; wide: boolean }) {
  const C = useColors();
  const L = useL();
  const styles = useStyles(makeStyles);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const key = titles.join('|');

  useEffect(() => onPreviewChange(setPlaying), []);
  useEffect(() => () => stopPreview(), []);

  useEffect(() => {
    let off = false;
    setAlbums(null);
    if (isDemo) {
      setAlbums([]);
      return;
    }
    findSoundtracks(titles, year)
      .then((a) => {
        if (off) return;
        setAlbums(a);
        setAlbum(a[0] ?? null);
      })
      .catch(() => !off && setAlbums([]));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, year]);

  useEffect(() => {
    if (!album) return;
    let off = false;
    setTracks(null);
    setAll(false);
    albumTracks(album.id)
      .then((t) => !off && setTracks(t))
      .catch(() => !off && setTracks([]));
    return () => {
      off = true;
    };
  }, [album]);

  const heading = (
    <T variant="heading">Banda sonora</T>
  );

  if (albums === null) {
    return (
      <View style={{ gap: Space.md }}>
        {heading}
        <Loading />
      </View>
    );
  }
  if (!albums.length) {
    const q = encodeURIComponent(`${titles[0]} soundtrack`);
    return (
      <View style={{ gap: Space.md }}>
        {heading}
        <T muted>No encontramos la banda sonora en Apple Music.</T>
        <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
          <LinkPill label="Spotify" onPress={() => Linking.openURL(`https://open.spotify.com/search/${q}`)} />
          <LinkPill label="YouTube Music" onPress={() => Linking.openURL(`https://music.youtube.com/search?q=${q}`)} />
        </View>
      </View>
    );
  }

  const shown = tracks ? (all ? tracks : tracks.slice(0, 10)) : [];
  const canPlay = Platform.OS === 'web';
  const q = encodeURIComponent(album ? `${album.name} ${album.artist}` : titles[0]);

  return (
    <View style={{ gap: Space.lg }}>
      {heading}
      {albums.length > 1 ? (
        <HScroll contentContainerStyle={{ gap: Space.md }}>
          {albums.map((a) => {
            const on = a.id === album?.id;
            return (
              <Touchable key={a.id} haptic="select" pressScale={0.96} onPress={() => setAlbum(a)} style={{ width: 150, gap: 6 }} accessibilityState={{ selected: on }}>
                <View style={[styles.cover, { width: 150, height: 150 }, on && { borderWidth: 3, borderColor: C.accent }]}>
                  {a.art ? <Image source={{ uri: a.art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                </View>
                <T raw numberOfLines={2} style={{ fontSize: 14, fontWeight: on ? '800' : '600', lineHeight: 18 }}>
                  {a.name}
                </T>
                <T raw variant="caption" muted numberOfLines={1}>
                  {[a.year, `${a.count} ${L('canciones', 'tracks')}`].filter(Boolean).join(' · ')}
                </T>
              </Touchable>
            );
          })}
        </HScroll>
      ) : null}

      {album ? (
        <View style={styles.box}>
          <View style={{ flexDirection: 'row', gap: Space.lg, alignItems: 'center', padding: Space.lg }}>
            <View style={[styles.cover, { width: wide ? 120 : 84, height: wide ? 120 : 84 }]}>
              {album.art ? <Image source={{ uri: album.art }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T raw numberOfLines={2} style={{ fontSize: wide ? 20 : 17, fontWeight: '800', letterSpacing: -0.3 }}>
                {album.name}
              </T>
              <T raw muted numberOfLines={1}>
                {[album.artist, album.year].filter(Boolean).join(' · ')}
              </T>
              <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap', marginTop: 6 }}>
                {album.url ? <LinkPill label="Apple Music" onPress={() => Linking.openURL(album.url!)} /> : null}
                <LinkPill label="Spotify" onPress={() => Linking.openURL(`https://open.spotify.com/search/${q}`)} />
                <LinkPill label="YouTube Music" onPress={() => Linking.openURL(`https://music.youtube.com/search?q=${q}`)} />
              </View>
            </View>
          </View>
          {!tracks ? (
            <Loading />
          ) : (
            shown.map((t, i) => {
              const on = playing === t.id;
              return (
                <Touchable
                  key={t.id}
                  haptic="select"
                  pressScale={0.99}
                  onPress={() => {
                    if (!togglePreview(t) && t.url) Linking.openURL(t.url);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name}, ${t.artist}`}
                  style={[styles.row, { borderTopWidth: 1, borderTopColor: C.border }, on && { backgroundColor: C.accentSoft }]}>
                  <View style={[styles.play, { backgroundColor: on ? C.accent : C.fill }]}>
                    {canPlay && t.preview ? (
                      <Icon name={on ? 'pause' : 'playSolid'} size={16} color={on ? C.onAccent : C.text} filled strokeWidth={2.4} />
                    ) : (
                      <T raw style={{ fontSize: 13, fontWeight: '700', color: C.textMuted }}>
                        {i + 1}
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T raw numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: on ? C.accentInk : C.text }}>
                      {t.name}
                    </T>
                    <T raw variant="caption" muted numberOfLines={1}>
                      {t.artist}
                    </T>
                  </View>
                  <T raw variant="caption" muted>
                    {trackTime(t.ms)}
                  </T>
                </Touchable>
              );
            })
          )}
          {tracks && tracks.length > 10 ? (
            <Touchable haptic="select" onPress={() => setAll(!all)} style={[styles.row, { borderTopWidth: 1, borderTopColor: C.border, justifyContent: 'center' }]}>
              <T raw style={{ fontSize: 15, fontWeight: '700', color: C.accentInk }}>
                {all ? L('Ver menos', 'Show less') : L(`Ver las ${tracks.length} canciones`, `Show all ${tracks.length} tracks`)}
              </T>
            </Touchable>
          ) : null}
        </View>
      ) : null}
      <T variant="caption" muted>
        {canPlay ? 'Toca una canción para escuchar 30 segundos. Datos de Apple Music.' : 'Datos de Apple Music.'}
      </T>
    </View>
  );
}

function LinkPill({ label, onPress }: { label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <Touchable haptic="light" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.fill }}>
      <Icon name="music" size={14} color={C.text} strokeWidth={2.2} />
      <T raw style={{ fontSize: 13, fontWeight: '700' }}>
        {label}
      </T>
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    box: { ...glassFill(C), borderRadius: Radius.lg, overflow: 'hidden' },
    cover: { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 10, paddingHorizontal: Space.lg },
    play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  });
