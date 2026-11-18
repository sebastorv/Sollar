/** Hoja que sube desde abajo (en computador, un panel centrado), con vidrio y fondo oscurecido. */

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Radius, Space, WIDE } from '@/constants/theme';
import { useColors } from '@/store/theme';

import { Glass } from './glass';
import { T } from './ui';

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const C = useColors();
  const wide = useWindowDimensions().width >= WIDE;
  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.wrap, { justifyContent: wide ? 'center' : 'flex-end' }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]} onPress={onClose} accessibilityLabel="Cerrar" />
        <Glass
          strong
          radius={wide ? Radius.lg : 28}
          style={[styles.sheet, !wide && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: -Space.lg }]}>
          {!wide ? <View style={[styles.grabber, { backgroundColor: C.border }]} /> : null}
          {title ? (
            <View style={{ gap: 2 }}>
              <T variant="heading">{title}</T>
              {subtitle ? (
                <T variant="small" muted>
                  {subtitle}
                </T>
              ) : null}
            </View>
          ) : null}
          {children}
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Space.lg },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: Space.xl, paddingBottom: Space.xxl + Space.md, gap: Space.lg },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: -Space.sm },
});
