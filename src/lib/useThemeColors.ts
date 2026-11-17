import { useEffect, useState } from 'react';

const TOKENS = [
  '--fg',
  '--muted',
  '--line',
  '--surface',
  '--accent',
  '--map-land',
  '--map-water',
  '--map-city',
  '--map-road',
  '--map-ring',
] as const;
export type ThemeColors = Record<(typeof TOKENS)[number], string>;

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(t).trim()])) as ThemeColors;
}

/** Canvas and SVG attributes cannot use CSS variables, so resolve them and follow theme changes. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return colors;
}
