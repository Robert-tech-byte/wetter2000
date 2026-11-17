import type { ReactNode } from 'react';

export function Section(props: { id: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={props.id} aria-labelledby={`${props.id}-title`}>
      <header className="section-head">
        <h2 id={`${props.id}-title`}>{props.title}</h2>
        {props.subtitle && <p className="muted">{props.subtitle}</p>}
      </header>
      {props.children}
    </section>
  );
}

export function ErrorNote({ what, error }: { what: string; error: string | null }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {what} konnte nicht geladen werden ({error}).
    </p>
  );
}
