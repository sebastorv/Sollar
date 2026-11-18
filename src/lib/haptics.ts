/**
 * Vibración al tocar, para que cada acción se sienta.
 *
 * - iPhone y Android con la app nativa: expo-haptics.
 * - Web en Android: navigator.vibrate.
 * - Web en iPhone (Safari 18 o más nuevo, también instalada en la pantalla de inicio): Safari no
 *   deja vibrar desde una página, pero sí da un toque háptico al cambiar un interruptor nativo;
 *   se usa un interruptor invisible para provocarlo.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'select' | 'success';

let iosSwitch: HTMLLabelElement | null = null;

function iosWebTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

const isIOSWeb =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const VIBRATE_MS: Record<HapticKind, number | number[]> = {
  light: 8,
  select: 6,
  medium: 14,
  heavy: 22,
  success: [10, 40, 16],
};

export function haptic(kind: HapticKind = 'light') {
  try {
    if (Platform.OS === 'web') {
      if (isIOSWeb) {
        iosWebTick();
        if (kind === 'success') setTimeout(iosWebTick, 90);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(VIBRATE_MS[kind]);
      }
      return;
    }
    if (kind === 'select') Haptics.selectionAsync();
    else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else
      Haptics.impactAsync(
        kind === 'heavy'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : kind === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
      );
  } catch {
    // Sin vibración disponible: no pasa nada.
  }
}
