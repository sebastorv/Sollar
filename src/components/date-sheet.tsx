/** Hoja para elegir cuándo viste algo: ahora, ayer, el día del estreno u otra fecha. */

import { tr } from '@/i18n';
import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { Space } from '@/constants/theme';
import { addDays, fromISO, todayISO } from '@/lib/dates';
import { useColors } from '@/store/theme';

import { Icon, type IconName } from './icons';
import { Sheet } from './sheet';
import { Touchable } from './touch';
import { Button, T } from './ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = fromISO(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Las 8 p. m. de ese día, hora local. */
const evening = (iso: string) => new Date(iso + 'T20:00:00').toISOString();

export function DateSheet({
  visible,
  onClose,
  title,
  releaseDate,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  releaseDate?: string | null;
  onPick: (at: string) => void;
}) {
  const C = useColors();
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(todayISO());
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date <= todayISO();
  const pick = (at: string) => {
    onPick(at);
    setPicking(false);
    onClose();
  };
  const released = !!releaseDate && releaseDate <= todayISO();
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setPicking(false);
        onClose();
      }}
      title={title}>
      {!picking ? (
        <View style={{ gap: 2 }}>
          <Row icon="check" label="Ahora" onPress={() => pick(new Date().toISOString())} />
          <Row icon="clock" label="Ayer" onPress={() => pick(evening(addDays(todayISO(), -1)))} />
          {released ? <Row icon="calendar" label={`El día del estreno (${shortDate(releaseDate)})`} onPress={() => pick(evening(releaseDate!))} /> : null}
          <Row icon="edit" label="Otra fecha" onPress={() => setPicking(true)} />
        </View>
      ) : (
        <View style={{ gap: Space.md }}>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.currentTarget.value)}
              style={{
                fontSize: 16,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: C.fill,
                color: C.text,
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder={tr("2024-05-31")}
              placeholderTextColor={C.textFaint}
              style={{ backgroundColor: C.fill, color: C.text, borderRadius: 12, padding: 12, fontSize: 16 }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            <Button label="Guardar" disabled={!valid} onPress={() => pick(evening(date))} style={{ flex: 1 }} />
            <Button label="Cancelar" kind="secondary" onPress={() => setPicking(false)} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <Touchable
      haptic="select"
      pressScale={0.98}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, paddingHorizontal: Space.xs }}>
      <View>
        <Icon name={icon} size={20} color={C.text} />
      </View>
      <T style={{ fontSize: 16, fontWeight: '500' }}>{label}</T>
    </Touchable>
  );
}
