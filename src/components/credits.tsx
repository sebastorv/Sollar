/**
 * Reparto y equipo, con pestañas: Actores, Dirección, Guion, Producción, Música, Fotografía…
 * Cada persona va con su foto (formato de carátula), cuántos episodios hizo (en series), su
 * nombre y su papel. Al tocarla se abre su página.
 */

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useL } from '@/i18n';
import { Radius, Space } from '@/constants/theme';
import { sharpImage, type CastMember, type CrewMember } from '@/lib/tmdb';
import { useColors } from '@/store/theme';

import { HScroll } from './hscroll';
import { Icon } from './icons';
import { Touchable } from './touch';
import { T } from './ui';

const DEPTS: { id: string; es: string; en: string }[] = [
  { id: 'Directing', es: 'Dirección', en: 'Directors' },
  { id: 'Writing', es: 'Guion', en: 'Writers' },
  { id: 'Production', es: 'Producción', en: 'Production' },
  { id: 'Sound', es: 'Música', en: 'Music' },
  { id: 'Camera', es: 'Fotografía', en: 'Camera' },
  { id: 'Editing', es: 'Edición', en: 'Editing' },
];

type Person = { id: number; name: string; role: string; profilePath: string | null; episodes?: number };

export function Credits({ cast, crew, isTv, wide }: { cast: CastMember[]; crew: CrewMember[]; isTv: boolean; wide: boolean }) {
  const C = useColors();
  const L = useL();
  const [tab, setTab] = useState('cast');

  const groups = useMemo(() => {
    const out: Record<string, Person[]> = { cast: cast.map((c) => ({ id: c.id, name: c.name, role: c.character, profilePath: c.profilePath, episodes: c.episodes })) };
    for (const d of DEPTS) {
      const seen = new Map<number, Person>();
      for (const m of crew.filter((x) => x.department === d.id)) {
        const p = seen.get(m.id);
        if (p) {
          if (!p.role.includes(m.job)) p.role = `${p.role}, ${m.job}`;
          p.episodes = Math.max(p.episodes ?? 0, m.episodes ?? 0) || undefined;
        } else seen.set(m.id, { id: m.id, name: m.name, role: m.job, profilePath: m.profilePath, episodes: m.episodes });
      }
      if (seen.size) out[d.id] = [...seen.values()].slice(0, 30);
    }
    return out;
  }, [cast, crew]);

  const tabs = [{ id: 'cast', label: L('Actores', 'Actors') }, ...DEPTS.filter((d) => groups[d.id]).map((d) => ({ id: d.id, label: L(d.es, d.en) }))];
  const people = groups[tab] ?? [];
  if (!cast.length && !crew.length) return null;
  const W = wide ? 150 : 116;

  return (
    <View style={{ gap: Space.lg }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: Space.md }}>
        <T variant="heading" style={{ marginRight: 'auto' }}>Reparto y equipo</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <Touchable
                key={t.id}
                haptic="select"
                onPress={() => setTab(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? C.accent : C.fill,
                }}>
                <T raw style={{ fontSize: 15, fontWeight: '700', color: on ? C.onAccent : C.text }}>
                  {t.label}
                </T>
              </Touchable>
            );
          })}
        </View>
      </View>
      <HScroll key={tab} contentContainerStyle={{ gap: Space.md }}>
        {people.map((p) => {
          const uri = sharpImage(p.profilePath, 'poster', W);
          return (
            <Link key={`${p.id}-${p.role}`} href={{ pathname: '/persona/[id]', params: { id: String(p.id) } }} asChild>
              <Touchable style={{ width: W, gap: 8 }} accessibilityLabel={`${p.name}, ${p.role}`}>
                <View style={{ width: W, height: Math.round(W * 1.5), borderRadius: Radius.md, overflow: 'hidden', backgroundColor: C.fill }}>
                  {uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <T raw style={{ fontSize: 34, fontWeight: '800', color: C.textMuted }}>
                        {p.name.charAt(0)}
                      </T>
                    </View>
                  )}
                  {isTv && p.episodes ? (
                    <View style={styles.eps}>
                      <Icon name="tv" size={13} color="#fff" strokeWidth={2.2} />
                      <T raw style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
                        {p.episodes} {L('ep.', 'eps')}
                      </T>
                    </View>
                  ) : null}
                </View>
                <View>
                  <T raw numberOfLines={1} style={{ fontSize: 15, fontWeight: '700' }}>
                    {p.name}
                  </T>
                  <T raw variant="caption" muted numberOfLines={1} style={{ minHeight: 16 }}>
                    {p.role || ' '}
                  </T>
                </View>
              </Touchable>
            </Link>
          );
        })}
      </HScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  eps: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14,13,18,0.72)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
