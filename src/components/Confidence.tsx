import { CONFIDENCE_WORD, type ConfidenceLevel } from '../lib/agreement';

export function ConfidenceDots({ level, models }: { level: ConfidenceLevel | null; models?: number }) {
  if (level == null) return <span className="conf none" aria-label="Treffsicherheit unbekannt" />;
  const word = CONFIDENCE_WORD[level];
  return (
    <span className={`conf c${level}`} title={`Treffsicherheit: ${word}`} aria-label={`Treffsicherheit: ${word}`}>
      <i />
      <i />
      <i />
      {models != null && models < 4 && <small aria-label={`${models} Modelle`}>{models}</small>}
    </span>
  );
}
