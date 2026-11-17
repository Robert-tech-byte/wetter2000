/** Wetter2000 mark: Munich skyline (Frauenkirche, Olympiaturm) with the Zugspitze, on deep blue. Generated from the brand concept. */
const SKYLINE = `<path d="M10 54V48.2l4-2.2 3.5 1.4 3-1.6 3.4-3.6 2.4 2.4 2.2-.9 3.4-2.6 3.1-1.7 1.6-2.4.9.7 1-1.3 1.4 1.3 2.8 4.6 2.6 2 3.4-.8 3.3 2.2 2.4-.6V54z" fill="#7FD0DC" opacity=".34"/><rect x="17.2" y="41" width="5.6" height="13.5" fill="#F3F6F8"/><path d="M16.81 41.5C16.81 36.8 18.21 35.16 20 34.56C21.79 35.16 23.19 36.8 23.19 41.5Z" fill="#F3F6F8"/><rect x="19.5" y="32.21" width="1.01" height="2.52" fill="#F3F6F8"/><circle cx="20" cy="31.76" r="0.84" fill="#F3F6F8"/><rect x="25.6" y="41" width="5.6" height="13.5" fill="#F3F6F8"/><path d="M25.21 41.5C25.21 36.8 26.61 35.16 28.4 34.56C30.19 35.16 31.59 36.8 31.59 41.5Z" fill="#F3F6F8"/><rect x="27.9" y="32.21" width="1.01" height="2.52" fill="#F3F6F8"/><circle cx="28.4" cy="31.76" r="0.84" fill="#F3F6F8"/><path d="M22.8 54.5V44.4l2-1.6 2 1.6v10.1z" fill="#F3F6F8"/><path d="M42.5 54.5 43.25 24h1.5l.75 30.5z" fill="#F3F6F8"/><path d="M38.6 24.6c0-1.3 2.4-2.1 5.4-2.1s5.4.8 5.4 2.1-2.4 1.9-5.4 1.9-5.4-.6-5.4-1.9z" fill="#F3F6F8"/><rect x="41.6" y="19.6" width="4.8" height="2.4" rx=".8" fill="#F3F6F8"/><rect x="43.6" y="9" width=".8" height="10.8" fill="#F3F6F8"/><rect x="10" y="54" width="44" height="1.6" rx=".8" fill="#F3F6F8"/>`;

export function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="logo"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="14" fill="#0F2D4A" />
      <g dangerouslySetInnerHTML={{ __html: SKYLINE }} />
    </svg>
  );
}
