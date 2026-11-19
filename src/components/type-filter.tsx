/**
 * Filtro mínimo de tipo, como el de Trakt: tres íconos (todo, series, películas) en una
 * píldora de vidrio. El elegido muestra también su nombre.
 */

import { View } from 'react-native';

import { useColors } from '@/store/theme';

import { glassFill } from './glass';
import { Icon, type IconName } from './icons';
import { Touchable } from './touch';
import { T } from './ui';

export type TypeValue = 'all' | 'tv' | 'movie';

const OPTIONS: { id: TypeValue; icon: IconName; label: string }[] = [
  { id: 'all', icon: 'grid', label: 'Todo' },
  { id: 'tv', icon: 'tv', label: 'Series' },
  { id: 'movie', icon: 'film', label: 'Películas' },
];

export function TypeFilter({
  value,
  onChange,
  options = ['all', 'tv', 'movie'],
}: {
  value: TypeValue;
  onChange: (v: TypeValue) => void;
  /** Cuáles mostrar (por ejemplo, solo series y películas). */
  options?: TypeValue[];
}) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 999, padding: 4, gap: 2, ...glassFill(C) }}>
      {OPTIONS.filter((o) => options.includes(o.id)).map((o) => {
        const on = o.id === value;
        return (
          <Touchable
            key={o.id}
            haptic="select"
            pressScale={0.92}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 36,
              paddingHorizontal: on ? 14 : 11,
              borderRadius: 999,
              backgroundColor: on ? C.accentSoft : 'transparent',
            }}>
            <Icon name={o.icon} size={18} color={on ? C.accent : C.textMuted} strokeWidth={1.8} />
            {on ? <T style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{o.label}</T> : null}
          </Touchable>
        );
      })}
    </View>
  );
}
