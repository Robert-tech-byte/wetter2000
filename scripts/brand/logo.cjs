// Generates the Wetter2000 mark (direction G with Zugspitze) as static SVG strings.
const r = (n) => +n.toFixed(2);
const tower = (x, y, w, h, fg) => {
  const top = y - w * 1.15;
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fg}"/>` +
    `<path d="M${r(x - w * 0.07)} ${r(y + 0.5)}C${r(x - w * 0.07)} ${r(y - w * 0.75)} ${r(x + w * 0.18)} ${r(top + 0.6)} ${r(x + w / 2)} ${r(top)}C${r(x + w * 0.82)} ${r(top + 0.6)} ${r(x + w * 1.07)} ${r(y - w * 0.75)} ${r(x + w * 1.07)} ${r(y + 0.5)}Z" fill="${fg}"/>` +
    `<rect x="${r(x + w / 2 - w * 0.09)}" y="${r(top - w * 0.42)}" width="${r(w * 0.18)}" height="${r(w * 0.45)}" fill="${fg}"/>` +
    `<circle cx="${r(x + w / 2)}" cy="${r(top - w * 0.5)}" r="${r(w * 0.15)}" fill="${fg}"/>`;
};
const skyline = (fg, alp) =>
  `<path d="M10 54V48.2l4-2.2 3.5 1.4 3-1.6 3.4-3.6 2.4 2.4 2.2-.9 3.4-2.6 3.1-1.7 1.6-2.4.9.7 1-1.3 1.4 1.3 2.8 4.6 2.6 2 3.4-.8 3.3 2.2 2.4-.6V54z" fill="${alp}" opacity=".34"/>` +
  tower(17.2, 41, 5.6, 13.5, fg) + tower(25.6, 41, 5.6, 13.5, fg) +
  `<path d="M22.8 54.5V44.4l2-1.6 2 1.6v10.1z" fill="${fg}"/>` +
  `<path d="M42.5 54.5 43.25 24h1.5l.75 30.5z" fill="${fg}"/>` +
  `<path d="M38.6 24.6c0-1.3 2.4-2.1 5.4-2.1s5.4.8 5.4 2.1-2.4 1.9-5.4 1.9-5.4-.6-5.4-1.9z" fill="${fg}"/>` +
  `<rect x="41.6" y="19.6" width="4.8" height="2.4" rx=".8" fill="${fg}"/>` +
  `<rect x="43.6" y="9" width=".8" height="10.8" fill="${fg}"/>` +
  `<rect x="10" y="54" width="44" height="1.6" rx=".8" fill="${fg}"/>`;
const mark = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="#0F2D4A"/>${skyline('#F3F6F8', '#7FD0DC')}</svg>`;
module.exports = { mark, skyline };
if (require.main === module) {
  const fs = require('fs'); const out = process.argv[2];
  fs.writeFileSync(`${out}/icon.svg`, mark(14));
  fs.writeFileSync(`${out}/icon-square.svg`, mark(0));
  fs.writeFileSync(`${out}/skyline-inner.txt`, skyline('#F3F6F8', '#7FD0DC'));
  console.log('ok');
}
