// Renders PNG app icons (square, full-bleed; the OS rounds the corners).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [L, out] = process.argv.slice(2);
  const svg = fs.readFileSync(`${L}/icon-square.svg`, 'utf8');
  const b = await chromium.launch();
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: `${out}/${name}` });
    await p.close();
  }
  await b.close();
  console.log('ok');
})();
