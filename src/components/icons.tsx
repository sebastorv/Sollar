/**
 * Iconos propios de Butaca. Trazo redondeado de 1.8 sobre una cuadrícula de 24,
 * con un motivo común: la butaca de cine (respaldo curvo y brazos), que aparece
 * en el icono de la app y en la pestaña Siguiendo.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/constants/theme';

export type IconName =
  | 'seat'
  | 'search'
  | 'ticket'
  | 'person'
  | 'check'
  | 'star'
  | 'starHalf'
  | 'filter'
  | 'back'
  | 'plus'
  | 'screen'
  | 'clock'
  | 'chevronDown'
  | 'chevronUp'
  | 'sparkle';

export function Icon({
  name,
  size = 22,
  color = C.text,
  filled = false,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Versión rellena, para la pestaña activa. */
  filled?: boolean;
  strokeWidth?: number;
}) {
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fill = filled ? color : 'none';
  const fillOpacity = filled ? 0.22 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'seat' ? (
        <>
          {/* Respaldo curvo de la butaca */}
          {/* Rellena, lleva el tapizado de terciopelo de la marca. */}
          <Path d="M6.5 13V7.5a5.5 5.5 0 0 1 11 0V13" {...s} fill={filled ? '#A8385F' : 'none'} />
          {/* Asiento */}
          <Path d="M5 13h14v3.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 16.2Z" {...s} fill={filled ? '#7A2848' : 'none'} />
          {/* Brazos y patas */}
          <Path d="M3.5 11.5v5M20.5 11.5v5M8 18v2.5M16 18v2.5" {...s} />
        </>
      ) : null}

      {name === 'search' ? (
        <>
          <Circle cx="10.5" cy="10.5" r="6" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M15 15l5 5" {...s} />
          {/* Destello del lente */}
          <Path d="M8 8.2a3 3 0 0 1 2.4-1.2" {...s} strokeWidth={strokeWidth * 0.8} />
        </>
      ) : null}

      {name === 'ticket' ? (
        <>
          {/* Boleta con muescas laterales y línea de corte */}
          <Path
            d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"
            {...s}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Path d="M14.5 6.5v1.5M14.5 11v2M14.5 16v1.5" {...s} />
        </>
      ) : null}

      {name === 'person' ? (
        <>
          <Circle cx="12" cy="8.5" r="3.5" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" {...s} />
        </>
      ) : null}

      {name === 'check' ? <Path d="M5 12.5l4.2 4.2L19 7" {...s} /> : null}

      {name === 'star' || name === 'starHalf' ? (
        <>
          <Path
            d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4-3.9 5.6-.8Z"
            {...s}
            fill={name === 'star' && filled ? color : 'none'}
          />
          {name === 'starHalf' ? (
            <Path d="M12 3.8v12.7l-5 2.7 1-5.6-4-3.9 5.6-.8Z" fill={color} stroke="none" />
          ) : null}
        </>
      ) : null}

      {name === 'filter' ? (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...s} />
          <Circle cx="15" cy="7" r="2" {...s} />
          <Circle cx="9" cy="17" r="2" {...s} />
        </>
      ) : null}

      {name === 'back' ? <Path d="M14.5 5.5L8 12l6.5 6.5" {...s} /> : null}
      {name === 'chevronDown' ? <Path d="M6.5 9.5L12 15l5.5-5.5" {...s} /> : null}
      {name === 'chevronUp' ? <Path d="M6.5 14.5L12 9l5.5 5.5" {...s} /> : null}
      {name === 'plus' ? <Path d="M12 5v14M5 12h14" {...s} /> : null}

      {name === 'screen' ? (
        <>
          {/* Pantalla de cine con el haz del proyector */}
          <Rect x="3.5" y="5" width="17" height="11" rx="2" {...s} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M9 20h6M12 16v4" {...s} />
        </>
      ) : null}

      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="8" {...s} />
          <Path d="M12 7.5V12l3 2" {...s} />
        </>
      ) : null}

      {name === 'sparkle' ? (
        <Path
          d="M12 4c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z"
          {...s}
          fill={fill}
          fillOpacity={fillOpacity}
        />
      ) : null}
    </Svg>
  );
}
