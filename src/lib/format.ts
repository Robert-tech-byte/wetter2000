const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export const fmt1 = (v: number | null | undefined) => (v == null ? '–' : nf1.format(v));
export const fmt0 = (v: number | null | undefined) => (v == null ? '–' : nf0.format(v));
export const temp = (v: number | null | undefined) => (v == null ? '–' : `${nf1.format(v)} °C`);
export const pct = (v: number | null | undefined) => (v == null ? '–' : `${nf0.format(v * 100)} %`);
export const mm = (v: number | null | undefined) => (v == null ? '–' : `${nf1.format(v)} mm`);
