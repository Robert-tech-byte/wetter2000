import { useEffect, useState } from 'react';

const TOKENS = ['--text', '--muted', '--grid', '--temp-max', '--temp-min', '--rain', '--eps', '--surface'] as const;
export type ThemeColors = Record<(typeof TOKENS)[number], string>;

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(t).trim()])) as ThemeColors;
}

/** SVG chart attributes cannot use CSS variables reliably, so resolve them and follow theme changes. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return colors;
}
