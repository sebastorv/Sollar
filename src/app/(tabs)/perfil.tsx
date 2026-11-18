/**
 * Perfil: tu portada, tu foto y tu nombre, tus números (tiempo viendo, racha), tus favoritos y
 * lo último que viste. Los ajustes viven aparte, detrás del engranaje.
 */

import { tr } from '@/i18n';
import { HScroll } from '@/components/hscroll';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, GlassButton } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { useTabScroll } from '@/components/tab-scroll';
import { Touchable } from '@/components/touch';
import { Button, Poster, RailContext, T } from '@/components/ui';
import { RAIL_WIDTH, Radius, Space, WIDE, type Colors } from '@/constants/theme';
import { eventsOf, streaks, totalsOf, MONTHS } from '@/lib/activity';
import { ago, followers as countFollowers, following as listFollowing, myProfile, type Profile } from '@/lib/social';
import { todayISO, addDays } from '@/lib/dates';
import { formatEpisode } from '@/lib/progress';
import { sharpImage } from '@/lib/tmdb';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { DarkScope, useColors, useStyles } from '@/store/theme';

/** "1 a 3 m", "4 m 12 d", "3 d 5 h": el tiempo total frente a la pantalla. */
function bigDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const d = Math.floor(h / 24);
  const months = Math.floor(d / 30);
  const years = Math.floor(months / 12);
  if (years) return [`${years} a`, months % 12 ? `${months % 12} m` : null].filter(Boolean).join(' ');
  if (months) return [`${months} m`, d % 30 ? `${d % 30} d` : null].filter(Boolean).join(' ');
  if (d) return [`${d} d`, h % 24 ? `${h % 24} h` : null].filter(Boolean).join(' ');
  return `${h} h`;
}

const n = (x: number) => x.toLocaleString('es-CO');

/** Reduce la foto a 320 px en el navegador, para guardarla liviana. */
async function shrink(dataUrl: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return dataUrl;
  const img = new window.Image();
  img.src = dataUrl;
  await img.decode();
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 320;
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function ProfileScreen() {
  return (
    <DarkScope>
      <ProfileBody />
    </DarkScope>
  );
}

function ProfileBody() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const rail = useContext(RailContext);
  const { onScroll } = useTabScroll();
  const { items } = useLibrary();
  const { profile, setProfile } = useSettings();
  const { email, userId, cloud } = useAuth();
  const [social, setSocial] = useState<{ me: Profile | null; followers: number; following: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [favPick, setFavTab] = useState<'tv' | 'movie' | null>(null);

  useEffect(() => {
    if (!cloud || !userId) return;
    let off = false;
    Promise.all([myProfile(userId), countFollowers(userId), listFollowing(userId)])
      .then(([me, f, g]) => !off && setSocial({ me, followers: f, following: g.length }))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [cloud, userId]);

  const events = useMemo(() => eventsOf(items), [items]);
  const totals = useMemo(() => totalsOf(events), [events]);
  const streak = useMemo(() => streaks(events, todayISO()), [events]);
  const since = events.length ? events[events.length - 1].day : null;
  const favorites = items.filter((i) => i.favorite);
  // Abre en la pestaña que tenga favoritos, si no eliges otra.
  const favTab = favPick ?? (favorites.some((i) => i.mediaType === 'tv') || !favorites.length ? 'tv' : 'movie');
  const favShown = favorites.filter((i) => i.mediaType === favTab);

  // Portada: la imagen de fondo de tu favorito más reciente o de lo último que viste.
  const coverItem =
    [...favorites].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find((i) => i.backdropPath) ??
    items.find((i) => i.key === events[0]?.key && i.backdropPath);
  const cover = sharpImage(coverItem?.backdropPath ?? null, 'backdrop', width);

  const name = profile.name || social?.me?.display_name || (email ? email.split('@')[0] : 'Tu perfil');
  const username = social?.me?.username;
  const recent = events.slice(0, 8);

  // Últimos siete días: cuáles tuvieron algo visto.
  const days = new Set(events.map((e) => e.day));
  const week = Array.from({ length: 7 }, (_, i) => days.has(addDays(todayISO(), i - 6)));

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: Platform.OS !== 'web',
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const url = Platform.OS === 'web' ? await shrink(a.uri) : `data:image/jpeg;base64,${a.base64}`;
    setProfile({ avatar: url });
  }

  async function share() {
    const text = `${name} en Sollar: ${n(totals.episodes)} episodios y ${n(totals.movies)} películas vistas.`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text });
      else await Share.share({ message: text });
    } catch {
      // Cancelado.
    }
  }

  const sidePad = wide ? (rail ? RAIL_WIDTH + Space.lg * 2 + Space.md : Space.xxl) : Space.lg;
  const heroH = wide ? 380 : 330;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Portada */}
        <View style={{ height: heroH + insets.top }}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
          <LinearGradient
            colors={cover ? ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.1)', C.tint, C.bg] : [C.accentSoft, C.bg]}
            locations={cover ? [0, 0.35, 0.75, 1] : undefined}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Engranaje y compartir */}
        <View style={[styles.topActions, { top: insets.top + Space.md, right: wide ? Space.xxl : Space.lg }]}>
          <CircleButton icon="share" label="Compartir perfil" onPress={share} />
          <CircleButton icon="gear" label="Ajustes" onPress={() => router.push('/ajustes')} />
        </View>

        <View style={[styles.body, { marginTop: -heroH * 0.48, paddingLeft: sidePad, paddingRight: wide ? Space.xxl : Space.lg }]}>
          {/* Foto, nombre y seguidores */}
          <View style={{ alignItems: 'center', gap: Space.sm }}>
            <Touchable haptic="light" pressScale={0.95} onPress={pickPhoto} accessibilityLabel="Cambiar foto de perfil">
              <View style={styles.avatarRing}>
                {profile.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <LinearGradient colors={[C.g1, C.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.avatar, styles.center]}>
                    <T style={{ fontSize: 48, fontWeight: '800', color: '#fff' }}>{name.charAt(0).toUpperCase()}</T>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Glass radius={999}>
                  <View style={[styles.center, { width: 36, height: 36 }]}>
                    <Icon name="camera" size={18} color={C.text} strokeWidth={2} />
                  </View>
                </Glass>
              </View>
            </Touchable>

            <Touchable haptic="light" pressScale={0.98} onPress={() => setEditing(true)} style={{ alignItems: 'center', gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                <T style={styles.name}>{name}</T>
                <View>
                  <Icon name="edit" size={18} color={C.textMuted} />
                </View>
              </View>
              {username ? <T style={{ fontSize: 17, color: C.textMuted }}>@{username}</T> : null}
              {profile.bio ? (
                <T style={{ fontSize: 15, color: C.text, textAlign: 'center', marginTop: 4, maxWidth: 420 }}>{profile.bio}</T>
              ) : null}
              {since ? (
                <T style={{ fontSize: 14, color: C.textFaint, marginTop: 4 }}>
                  Viendo desde {MONTHS[Number(since.slice(5, 7)) - 1]} de {since.slice(0, 4)}
                </T>
              ) : null}
            </Touchable>

            {cloud ? (
              <Touchable haptic="light" onPress={() => router.push('/amigos')} style={styles.followRow}>
                <T style={styles.followNum}>{social?.followers ?? 0}</T>
                <T style={styles.followLabel}>Seguidores</T>
                <View style={{ width: Space.xl }} />
                <T style={styles.followNum}>{social?.following ?? 0}</T>
                <T style={styles.followLabel}>Siguiendo</T>
              </Touchable>
            ) : null}
          </View>

          {/* Números */}
          <View style={styles.stats}>
            <View style={styles.statCol}>
              <T style={styles.statHead}>TIEMPO VIENDO</T>
              <T style={styles.statBig}>{bigDuration(totals.minutes)}</T>
              <T style={styles.statSub}>
                {n(totals.episodes)} episodios · {n(totals.movies)} películas
              </T>
            </View>
            <View style={[styles.statCol, styles.statDivider]}>
              <T style={styles.statHead}>RACHA</T>
              <T style={styles.statBig}>
                {streak.current}
                <T style={styles.statUnit}> {streak.current === 1 ? 'día' : 'días'}</T>
              </T>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                {week.map((on, i) => (
                  <View
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      backgroundColor: on ? C.accent : C.fill,
                      borderWidth: i === 6 ? 1.5 : 0,
                      borderColor: C.text,
                    }}
                  />
                ))}
              </View>
            </View>
            <Touchable haptic="light" onPress={() => router.push('/estadisticas')} style={[styles.statCol, styles.statDivider]}>
              <T style={styles.statHead}>RÉCORD</T>
              <T style={styles.statBig}>
                {streak.longest}
                <T style={styles.statUnit}> días</T>
              </T>
              <T style={[styles.statSub, { color: C.accentInk, fontWeight: '700' }]}>Más estadísticas ›</T>
            </Touchable>
          </View>

          {/* Favoritos */}
          <View style={{ gap: Space.md }}>
            <View>
              <T style={styles.h2}>Favoritos</T>
              <T style={{ fontSize: 15, color: C.textMuted }}>Lo que siempre vuelves a ver</T>
            </View>
            <View style={styles.segment}>
              {(
                [
                  ['tv', 'Series'],
                  ['movie', 'Películas'],
                ] as const
              ).map(([k, label]) => {
                const on = favTab === k;
                const count = favorites.filter((i) => i.mediaType === k).length;
                return (
                  <Touchable key={k} haptic="select" onPress={() => setFavTab(k)} style={[styles.segmentBtn, on && styles.segmentOn]}>
                    <T style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? C.text : C.textMuted }}>
                      {label} {count}
                    </T>
                  </Touchable>
                );
              })}
            </View>
            {favShown.length ? (
              <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md }}>
                {favShown.map((i) => (
                  <Link key={i.key} href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: i.mediaType, id: String(i.tmdbId) } }} asChild>
                    <Touchable style={{ width: wide ? 160 : 128 }}>
                      <Poster path={i.posterPath} title={i.title} width={wide ? 160 : 128} />
                    </Touchable>
                  </Link>
                ))}
              </HScroll>
            ) : (
              <T style={{ color: C.textMuted }}>Toca el corazón en cualquier título para tenerlo aquí.</T>
            )}
          </View>

          {/* Lo último */}
          {recent.length ? (
            <View style={{ gap: Space.md }}>
              <Touchable haptic="light" onPress={() => router.push('/historial')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T style={styles.h2}>Lo último que viste</T>
                <View>
                  <Icon name="chevronRight" size={20} color={C.textMuted} strokeWidth={2.4} />
                </View>
              </Touchable>
              <View style={styles.list}>
                {recent.map((e, idx) => (
                  <Link key={e.key + e.at} href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: e.mediaType, id: String(e.tmdbId) } }} asChild>
                    <Touchable haptic="light" pressScale={0.98} style={[styles.recentRow, idx > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                      <Poster path={e.posterPath} title={e.title} width={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T numberOfLines={1} style={{ fontSize: 16, fontWeight: '700' }}>
                          {e.title}
                        </T>
                        <T numberOfLines={1} style={{ fontSize: 14, color: C.textMuted }}>
                          {e.season != null ? formatEpisode(e.season, e.episode!) : e.rewatch ? 'Película · otra vez' : 'Película'}
                        </T>
                      </View>
                      <T style={{ fontSize: 13, color: C.textFaint }}>{ago(e.at)}</T>
                    </Touchable>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}

          {/* Accesos */}
          <View style={styles.list}>
            {(
              [
                ['chart', 'Estadísticas y tu año', '/estadisticas'],
                ['history', 'Historial', '/historial'],
                ['users', 'Amigos', '/amigos'],
                ['gear', 'Ajustes', '/ajustes'],
              ] as [IconName, string, '/estadisticas' | '/historial' | '/amigos' | '/ajustes'][]
            ).map(([icon, label, href], idx) => (
              <Touchable
                key={href}
                haptic="light"
                pressScale={0.98}
                onPress={() => router.push(href)}
                style={[styles.linkRow, idx > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                <View>
                  <Icon name={icon} size={22} color={C.text} />
                </View>
                <T style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>{label}</T>
                <View>
                  <Icon name="chevronRight" size={18} color={C.textFaint} />
                </View>
              </Touchable>
            ))}
          </View>
        </View>
      </ScrollView>

      <EditProfile visible={editing} onClose={() => setEditing(false)} initialName={name} />
    </View>
  );
}

function CircleButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <GlassButton icon={icon} label={label} onPress={onPress} />;
}

function EditProfile({ visible, onClose, initialName }: { visible: boolean; onClose: () => void; initialName: string }) {
  const C = useColors();
  const { profile, setProfile } = useSettings();
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(profile.bio);
  useEffect(() => {
    if (visible) {
      setName(profile.name || initialName);
      setBio(profile.bio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const input = { backgroundColor: C.fill, color: C.text, borderRadius: 14, padding: 14, fontSize: 16 } as const;
  return (
    <Sheet visible={visible} onClose={onClose} title="Editar perfil">
      <View style={{ gap: Space.sm }}>
        <T variant="label">Nombre</T>
        <TextInput value={name} onChangeText={setName} maxLength={40} placeholder={tr("Tu nombre")} placeholderTextColor={C.textFaint} style={input} />
        <T variant="label">Una frase sobre ti</T>
        <TextInput
          value={bio}
          onChangeText={setBio}
          maxLength={120}
          multiline
          placeholder={tr("Fan de las series de misterio…")}
          placeholderTextColor={C.textFaint}
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <Button
          label="Guardar"
          style={{ flex: 1 }}
          onPress={() => {
            setProfile({ name: name.trim(), bio: bio.trim() });
            onClose();
          }}
        />
        {profile.avatar ? (
          <Button label="Quitar foto" kind="secondary" style={{ flex: 1 }} onPress={() => setProfile({ avatar: null })} />
        ) : null}
      </View>
    </Sheet>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    topActions: { position: 'absolute', flexDirection: 'row', gap: Space.sm },
    body: { width: '100%', maxWidth: 1100, alignSelf: 'center', gap: Space.xxl },
    avatarRing: {
      padding: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    avatar: { width: 128, height: 128, borderRadius: 64, overflow: 'hidden' },
    cameraBadge: { position: 'absolute', right: 0, bottom: 4 },
    name: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8, color: C.text, textAlign: 'center' },
    followRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: Space.sm },
    followNum: { fontSize: 20, fontWeight: '800', color: C.text },
    followLabel: { fontSize: 16, color: C.textMuted },
    stats: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: C.border,
      paddingVertical: Space.lg,
    },
    statCol: { flex: 1, gap: 4, paddingRight: Space.sm },
    statDivider: { borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: Space.md },
    statHead: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: C.textMuted },
    statBig: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6, color: C.text },
    statUnit: { fontSize: 15, fontWeight: '700', color: C.textMuted },
    statSub: { fontSize: 13, color: C.textMuted },
    h2: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, color: C.text },
    segment: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 16, padding: 4, alignSelf: 'flex-start', minWidth: 280 },
    segmentBtn: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.md },
    segmentOn: { backgroundColor: C.surfaceHigh },
    list: { backgroundColor: C.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: Space.md },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm + 2 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md + 2 },
  });
