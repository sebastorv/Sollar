/** Amigos: tu perfil público, buscar y seguir personas, y lo que están viendo. */

import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { card } from '@/components/glass';
import { Icon } from '@/components/icons';
import { Touchable } from '@/components/touch';
import { Button, Chip, Empty, Loading, Poster, Screen, Section, T } from '@/components/ui';
import { Radius, Space, type Colors } from '@/constants/theme';
import {
  ago,
  follow,
  followers,
  following,
  friendsActivity,
  myProfile,
  saveProfile,
  searchProfiles,
  unfollow,
  type FriendEvent,
  type Profile,
} from '@/lib/social';
import { useAuth } from '@/store/auth';
import { useColors, useStyles } from '@/store/theme';

export default function FriendsScreen() {
  const { userId, email, cloud } = useAuth();
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    myProfile(userId)
      .then(setMe)
      .catch((e: Error) => {
        setError(e.message);
        setMe(null);
      });
  }, [userId]);
  useEffect(load, [load]);

  return (
    <Screen>
      <View style={{ paddingTop: 52, gap: Space.xs }}>
        <T variant="title">Amigos</T>
        <T muted>Sigue a tus amigos y mira qué están viendo.</T>
      </View>
      {!cloud || !userId ? (
        <Empty title="Necesitas una cuenta" message="Entra con tu correo para usar la parte social." />
      ) : error && !me ? (
        <Empty title="Aún no está activo" message={error} />
      ) : me === undefined ? (
        <Loading />
      ) : !me ? (
        <ProfileForm userId={userId} suggested={(email ?? '').split('@')[0]} onSaved={load} />
      ) : (
        <Social me={me} userId={userId} onEdit={() => setMe(null)} />
      )}
    </Screen>
  );
}

function ProfileForm({
  userId,
  suggested,
  initial,
  onSaved,
}: {
  userId: string;
  suggested: string;
  initial?: Profile;
  onSaved: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [username, setUsername] = useState(initial?.username ?? suggested.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24));
  const [name, setName] = useState(initial?.display_name ?? '');
  const [isPublic, setPublic] = useState(initial?.is_public ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveProfile(userId, { username, display_name: name.trim(), is_public: isPublic });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <T variant="heading">Tu perfil</T>
      <T variant="small" muted>
        Elige un nombre de usuario para que tus amigos te encuentren.
      </T>
      <T variant="label">Usuario</T>
      <TextInput
        value={username}
        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
        autoCapitalize="none"
        placeholder="sebas"
        placeholderTextColor={C.textFaint}
        style={styles.input}
        accessibilityLabel="Usuario"
      />
      <T variant="label">Nombre que verán</T>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Sebas"
        placeholderTextColor={C.textFaint}
        style={styles.input}
        accessibilityLabel="Nombre"
      />
      <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
        <Chip label="Mi actividad es pública" selected={isPublic} onPress={() => setPublic(true)} />
        <Chip label="Privada" selected={!isPublic} onPress={() => setPublic(false)} />
      </View>
      <T variant="caption" muted>
        Pública: quienes te sigan ven lo que marcas. Privada: te pueden encontrar, pero no ven tu actividad.
      </T>
      {error ? <T variant="small" style={{ color: C.danger }}>{error}</T> : null}
      <Button label={busy ? 'Guardando…' : 'Guardar perfil'} disabled={username.length < 3 || busy} onPress={save} />
    </View>
  );
}

function Social({ me, userId, onEdit }: { me: Profile; userId: string; onEdit: () => void }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Profile[]>([]);
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [fans, setFans] = useState(0);
  const [feed, setFeed] = useState<FriendEvent[] | null>(null);

  const refresh = useCallback(async () => {
    const f = await following(userId).catch(() => []);
    setPeople(f);
    setFans(await followers(userId).catch(() => 0));
    setFeed(await friendsActivity(f).catch(() => []));
  }, [userId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => searchProfiles(q, userId).then(setFound).catch(() => setFound([])), 300);
    return () => clearTimeout(t);
  }, [q, userId]);

  const ids = new Set((people ?? []).map((p) => p.id));

  return (
    <>
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
        <Avatar p={me} size={52} />
        <View style={{ flex: 1 }}>
          <T variant="heading" numberOfLines={1}>
            {me.display_name || me.username}
          </T>
          <T variant="small" muted>
            @{me.username} · {people?.length ?? 0} siguiendo · {fans} {fans === 1 ? 'seguidor' : 'seguidores'}
          </T>
          <T variant="caption" muted>
            Actividad {me.is_public ? 'pública' : 'privada'}
          </T>
        </View>
        <Button label="Editar" kind="secondary" onPress={onEdit} />
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={C.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por usuario o nombre"
          placeholderTextColor={C.textFaint}
          autoCapitalize="none"
          style={[styles.searchInput, { outlineStyle: 'none' } as object]}
          accessibilityLabel="Buscar amigos"
        />
      </View>
      {found.length ? (
        <View style={styles.list}>
          {found.map((p, i) => (
            <PersonRow
              key={p.id}
              p={p}
              first={i === 0}
              on={ids.has(p.id)}
              onToggle={async () => {
                await (ids.has(p.id) ? unfollow(userId, p.id) : follow(p.id));
                refresh();
              }}
            />
          ))}
        </View>
      ) : q.length >= 2 ? (
        <T variant="small" muted>
          Nadie con ese nombre todavía. Comparte Sollar y dile tu usuario: @{me.username}
        </T>
      ) : null}

      {people && people.length ? (
        <Section title={`Siguiendo (${people.length})`}>
          <View style={styles.list}>
            {people.map((p, i) => (
              <PersonRow
                key={p.id}
                p={p}
                first={i === 0}
                on
                onToggle={async () => {
                  await unfollow(userId, p.id);
                  refresh();
                }}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Lo que ven tus amigos">
        {feed == null ? (
          <Loading />
        ) : feed.length === 0 ? (
          <T variant="small" muted>
            Cuando sigas a alguien con actividad pública, aquí verás lo que marca.
          </T>
        ) : (
          <View style={styles.list}>
            {feed.map((e, i) => (
              <Link
                key={`${e.profile.id}:${e.key}`}
                href={{ pathname: '/titulo/[tipo]/[id]', params: { tipo: e.mediaType, id: String(e.tmdbId) } }}
                asChild>
                <Touchable
                  pressScale={0.98}
                  style={StyleSheet.flatten([styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }])}>
                  <Avatar p={e.profile} size={36} />
                  <View style={{ flex: 1 }}>
                    <T variant="small" numberOfLines={2}>
                      <T variant="small" style={{ fontWeight: '700' }}>
                        {e.profile.display_name || e.profile.username}
                      </T>{' '}
                      {e.text} · <T variant="small" style={{ fontWeight: '700' }}>{e.title}</T>
                    </T>
                    <T variant="caption" muted>
                      {ago(e.at)}
                    </T>
                  </View>
                  <Poster path={e.posterPath} title={e.title} width={36} />
                </Touchable>
              </Link>
            ))}
          </View>
        )}
      </Section>
    </>
  );
}

function PersonRow({ p, on, first, onToggle }: { p: Profile; on: boolean; first: boolean; onToggle: () => void }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: C.border }]}>
      <Avatar p={p} size={36} />
      <View style={{ flex: 1 }}>
        <T variant="label" numberOfLines={1}>
          {p.display_name || p.username}
        </T>
        <T variant="caption" muted>
          @{p.username}
        </T>
      </View>
      <Button label={on ? 'Siguiendo' : 'Seguir'} kind={on ? 'secondary' : 'primary'} onPress={onToggle} />
    </View>
  );
}

/** Círculo con la inicial y un color estable por persona. */
function Avatar({ p, size }: { p: Profile; size: number }) {
  const C = useColors();
  const name = p.display_name || p.username;
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `hsl(${hue}, 70%, ${C.mode === 'dark' ? 35 : 82}%)`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T style={{ fontSize: size * 0.42, fontWeight: '800', color: C.text }}>{name.charAt(0).toUpperCase()}</T>
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    card: { ...card(C), borderRadius: Radius.lg, padding: Space.lg, gap: Space.md },
    input: { backgroundColor: C.fill, borderRadius: Radius.md, padding: Space.md, fontSize: 16, color: C.text },
    search: {
      ...card(C),
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      borderRadius: Radius.pill,
      paddingHorizontal: Space.lg,
    },
    searchInput: { flex: 1, paddingVertical: Space.md, fontSize: 16, color: C.text },
    list: { ...card(C), borderRadius: Radius.lg, paddingHorizontal: Space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm + 2 },
  });
