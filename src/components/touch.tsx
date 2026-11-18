/**
 * Touchable: reemplazo de Pressable con respuesta física.
 * Al tocar se encoge un poco y vibra; al soltar vuelve con un pequeño rebote.
 * Acepta lo mismo que Pressable (estilos y contenido como función de "pressed").
 */

import { useRef, useState, type ReactNode, type Ref } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { haptic, type HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const native = Platform.OS !== 'web';

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  /** Tipo de vibración; false para ninguna. */
  haptic?: HapticKind | false;
  /** Cuánto se encoge al presionar (1 = nada). */
  pressScale?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref?: Ref<any>;
};

export function Touchable({
  style,
  children,
  haptic: kind = 'light',
  pressScale = 0.96,
  onPressIn,
  onPressOut,
  disabled,
  ref,
  ...rest
}: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const state = { pressed, hovered: false } as PressableStateCallbackType;

  function down(e: GestureResponderEvent) {
    setPressed(true);
    if (kind) haptic(kind);
    Animated.spring(scale, { toValue: pressScale, useNativeDriver: native, speed: 50, bounciness: 0 }).start();
    onPressIn?.(e);
  }
  function up(e: GestureResponderEvent) {
    setPressed(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 14 }).start();
    onPressOut?.(e);
  }

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      disabled={disabled}
      onPressIn={down}
      onPressOut={up}
      style={[typeof style === 'function' ? style(state) : style, { transform: [{ scale }] }]}>
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
