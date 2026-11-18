/**
 * Novedades: lo nuevo en las plataformas de streaming en Colombia (primero las que pagas),
 * lo que se estrena pronto y los tráileres más recientes. Se abre desde la campana de Siguiendo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { HScroll } from '@/components/hscroll';
import { Icon } from '@/components/icons';
import { ProviderLogo, useProviderDirectory } from '@/components/platforms';
import { TitleCard } from '@/components/title-card';
import { Touchable } from '@/components/touch';
import { Empty, Loading, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { dayLabel, todayISO, addDays } from '@/lib/dates';
import { getComingSoon, getStreamingNews, getTrailerKey, isDemo, MAIN_PROVIDERS } from '@/lib/tmdb';
import type { MediaType, TmdbSearchResult } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { useColors } from '@/store/theme';

import { NEWS_SEEN_KEY } from '@/lib/news';

type News = TmdbSearchResult & { newDate: string };

export default function NewsScreen() {
  const C = useColors();
  const { myProviders } = useSettings();
  const { list: directory } = useProviderDirectory();
  const [news, setNews] = useState<Record<number, News[]> | null>(null);
  const [soon, setSoon] = useState<TmdbSearchResult[] | null>(null);
  const [trailers, setTrailers] = useState<{ item: TmdbSearchResult; key: string }[]>([]);

  // Tus plataformas primero; luego las principales del país.
  const providers = useMemo(() => {
    const mine = myProviders.slice(0, 6).map((id) => ({ id, name: directory?.find((d) => d.id === id)?.name ?? '' }));
    const rest = MAIN_PROVIDERS.filter((p) => !myProviders.includes(p.id));
    return [...mine, ...rest].slice(0, 8);
  }, [myProviders, directory]);

  useEffect(() => {
    AsyncStorage.setItem(NEWS_SEEN_KEY, new Date().toISOString()).catch(() => {});
  }, []);

  useEffect(() => {
    let off = false;
    Promise.all(providers.map((p) => getStreamingNews(p.id).catch(() => [] as News[]))).then((all) => {
      if (off) return;
      const out: Record<number, News[]> = {};
      providers.forEach((p, i) => (out[p.id] = all[i]));
      setNews(out);
    });
    getComingSoon()
      .then(async (list) => {
        if (off) return;
        setSoon(list);
        const top = list.filter((x) => x.poster_path).slice(0, 10);
        const keys = await Promise.all(top.map((x) => getTrailerKey(x.media_type as MediaType, x.id).catch(() => null)));
        if (!off) setTrailers(top.map((item, i) => ({ item, key: keys[i] ?? '' })).filter((t) => t.key));
      })
      .catch(() => setSoon([]));
    return () => {
      off = true;
    };
  }, [providers]);

  const weekAgo = addDays(todayISO(), -7);

  return (
    <Screen>
      <View style={{ paddingTop: 44, gap: 4 }}>
        <T variant="title">Novedades</T>
        <T muted>Lo nuevo en streaming en Colombia, lo que viene y los tráileres.</T>
      </View>

      {isDemo ? (
        <Empty title="Modo demostración" message="Inicia sesión para ver el catálogo." />
      ) : !news ? (
        <Loading />
      ) : (
        providers.map((p) => {
          const items = (news[p.id] ?? []).filter((x) => x.poster_path);
          if (!items.length) return null;
          const info = directory?.find((d) => d.id === p.id);
          return (
            <View key={p.id} style={{ gap: Space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                <ProviderLogo name={info?.name ?? p.name} logoPath={info?.logoPath ?? null} size={30} />
                <T variant="heading">Nuevo en {info?.name ?? p.name}</T>
                {myProviders.includes(p.id) ? (
                  <View style={{ backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <T style={{ fontSize: 11, fontWeight: '700', color: C.accentInk }}>En tu plan</T>
                  </View>
                ) : null}
              </View>
              <HScroll contentContainerStyle={{ gap: Space.md }}>
                {items.map((x) => (
                  <View key={`${x.media_type}:${x.id}`}>
                    <TitleCard
                      id={x.id}
                      mediaType={x.media_type as MediaType}
                      title={x.title ?? x.name ?? ''}
                      posterPath={x.poster_path}
                      subtitle={x.media_type === 'tv' ? 'Episodios nuevos' : x.newDate ? dayLabel(x.newDate) : null}
                      width={124}
                    />
                    {x.newDate >= weekAgo ? (
                      <View style={[styles.newTag, { backgroundColor: C.accent }]}>
                        <T style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>NUEVO</T>
                      </View>
                    ) : null}
                  </View>
                ))}
              </HScroll>
            </View>
          );
        })
      )}

      {trailers.length ? (
        <Section title="Tráileres">
          <HScroll contentContainerStyle={{ gap: Space.md }}>
            {trailers.map(({ item, key }) => (
              <Touchable
                key={key}
                haptic="light"
                pressScale={0.97}
                onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${key}`)}
                style={{ width: 280, gap: 6 }}>
                <View style={{ width: 280, aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
                  <Image source={{ uri: `https://i.ytimg.com/vi/${key}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Glass radius={999}>
                      <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="playSolid" size={22} color="#fff" />
                      </View>
                    </Glass>
                  </View>
                </View>
                <T numberOfLines={1} style={{ fontSize: 15, fontWeight: '700' }}>
                  {item.title ?? item.name}
                </T>
              </Touchable>
            ))}
          </HScroll>
        </Section>
      ) : null}

      {soon && soon.length ? (
        <Section title="Próximamente">
          <HScroll contentContainerStyle={{ gap: Space.md }}>
            {soon
              .filter((x) => x.poster_path)
              .slice(0, 30)
              .map((x) => (
                <View key={`${x.media_type}:${x.id}`}>
                    <TitleCard
                      id={x.id}
                      mediaType={x.media_type as MediaType}
                      title={x.title ?? x.name ?? ''}
                      posterPath={x.poster_path}
                      subtitle={dayLabel(x.release_date ?? x.first_air_date ?? todayISO())}
                      width={124}
                    />
                </View>
              ))}
          </HScroll>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  newTag: { position: 'absolute', right: 6, bottom: 62, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
});
