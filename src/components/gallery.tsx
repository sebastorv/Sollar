/**
 * Videos e imágenes de un título: tráileres y clips (YouTube), fondos de pantalla sin texto y
 * carátulas. Al tocar una imagen se abre en grande, con botón para descargarla en máxima calidad.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space } from '@/constants/theme';
import { imageUrl, sharpImage, type TitleExtras } from '@/lib/tmdb';
import { useColors } from '@/store/theme';

import { Glass } from './glass';
import { Icon } from './icons';
import { Touchable } from './touch';
import { Section, T } from './ui';

const VIDEO_TYPE: Record<string, string> = {
  Trailer: 'Tráiler',
  Teaser: 'Avance',
  Clip: 'Clip',
  Featurette: 'Detrás de cámaras',
  'Behind the Scenes': 'Detrás de cámaras',
  Bloopers: 'Tomas falsas',
  'Opening Credits': 'Intro',
  Recap: 'Resumen',
};

export function Gallery({ extras }: { extras: TitleExtras }) {
  const C = useColors();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<{ path: string; aspect: number } | null>(null);
  const videoW = Math.min(width * 0.72, 340);
  const wallW = Math.min(width * 0.78, 420);

  if (!extras.videos.length && !extras.backdrops.length && !extras.posters.length) {
    return <T muted>Este título todavía no tiene videos ni imágenes.</T>;
  }

  return (
    <View style={{ gap: Space.xxl }}>
      {extras.videos.length ? (
        <Section title="Videos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
            {extras.videos.map((v) => (
              <Touchable
                key={v.key}
                haptic="light"
                pressScale={0.97}
                onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${v.key}`)}
                accessibilityLabel={`Ver ${v.name}`}
                style={{ width: videoW, gap: 6 }}>
                <View style={{ width: videoW, aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
                  <Image
                    source={{ uri: `https://i.ytimg.com/vi/${v.key}/hqdefault.jpg` }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Glass radius={999}>
                      <View style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="playSolid" size={24} color="#fff" />
                      </View>
                    </Glass>
                  </View>
                  <View style={styles.tag}>
                    <T style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{(VIDEO_TYPE[v.type] ?? v.type).toUpperCase()}</T>
                  </View>
                </View>
                <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
                  {v.name}
                </T>
              </Touchable>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {extras.backdrops.length ? (
        <Section title={`Fondos de pantalla · ${extras.backdrops.length}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
            {extras.backdrops.map((b) => (
              <Touchable key={b.path} haptic="light" pressScale={0.97} onPress={() => setOpen(b)} accessibilityLabel="Ver en grande">
                <Image
                  source={{ uri: sharpImage(b.path, 'backdrop', wallW) ?? undefined }}
                  style={{ width: wallW, aspectRatio: b.aspect, borderRadius: Radius.md, backgroundColor: C.fill }}
                  contentFit="cover"
                  transition={200}
                />
              </Touchable>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {extras.posters.length > 1 ? (
        <Section title={`Carátulas · ${extras.posters.length}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
            {extras.posters.map((p) => (
              <Touchable key={p} haptic="light" pressScale={0.97} onPress={() => setOpen({ path: p, aspect: 2 / 3 })}>
                <Image
                  source={{ uri: sharpImage(p, 'poster', 130) ?? undefined }}
                  style={{ width: 130, aspectRatio: 2 / 3, borderRadius: Radius.md, backgroundColor: C.fill }}
                  contentFit="cover"
                  transition={200}
                />
              </Touchable>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <Viewer image={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function Viewer({ image, onClose }: { image: { path: string; aspect: number } | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  if (!image) return null;
  const full = imageUrl(image.path, 'original');
  // Cabe completa en la pantalla, sin recortes.
  const w = Math.min(width, (height - insets.top - insets.bottom - 140) * image.aspect);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <Image source={{ uri: full ?? undefined }} style={{ width: w, aspectRatio: image.aspect, borderRadius: 12 }} contentFit="contain" transition={200} />
        <View style={{ position: 'absolute', top: insets.top + Space.md, right: Space.lg }}>
          <Touchable haptic="light" onPress={onClose} accessibilityLabel="Cerrar">
            <Glass radius={999}>
              <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={20} color="#fff" strokeWidth={2.4} />
              </View>
            </Glass>
          </Touchable>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + Space.xl }}>
          <Touchable
            haptic="medium"
            onPress={() => {
              if (!full) return;
              if (Platform.OS === 'web') window.open(full, '_blank');
              else Linking.openURL(full);
            }}>
            <Glass radius={999}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.xl, height: 50 }}>
                <Icon name="arrowDown" size={20} color="#fff" strokeWidth={2.4} />
                <T style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Descargar en alta calidad</T>
              </View>
            </Glass>
          </Touchable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
