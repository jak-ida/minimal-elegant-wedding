/* Load test of the BUILT buyer ZIP, exactly as a buyer would use it.
   Extracts the ZIP to a temp folder, starts the SHIPPED tools/serve.ps1 on it, opens the page in Chrome and checks it.
   Usage:  node dev-tests/zip-smoke.js [path-to-zip]      (default: newest ZIP in dist/)   Windows only (uses PowerShell). */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { launch, open, sleep, check, note, section, summary, overflowReport, scrollThrough } = require('./qa-helpers');

const ROOT = path.join(__dirname, '..');
const dist = path.join(ROOT, 'dist');
const zip = process.argv[2] || fs.readdirSync(dist).filter(f => f.endsWith('.zip')).map(f => path.join(dist, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
if (!zip) { console.error('No ZIP found'); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'wt-smoke-'));
const PORT = 8766;
let server;

async function waitFor(url, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.ok) return true; } catch (e) { /* not up yet */ } await sleep(300); }
  return false;
}

(async () => {
  note('ZIP under test: ' + zip);
  execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory('${zip}', '${tmp}')`]);
  const pkg = path.join(tmp, 'wedding-template');
  const demoPhotos = !fs.readFileSync(path.join(pkg, 'js', 'config.js'), 'utf8').includes('Placeholder image');

  section('S1. Buyer starts the shipped Windows preview server');
  server = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(pkg, 'tools', 'serve.ps1'), '-Port', String(PORT), '-NoBrowser'], { stdio: 'ignore', windowsHide: true });
  const up = await waitFor(`http://localhost:${PORT}/`);
  check('tools/serve.ps1 starts and serves the extracted folder on localhost', up);
  if (!up) { cleanup(); return finish(); }
  const types = {};
  for (const f of ['index.html', 'css/styles.css', 'js/config.js', 'js/main.js', 'assets/fonts/dmsans-normal-latin.woff2', 'assets/images/hero-864.webp', 'assets/images/og-image.jpg', 'assets/icons/favicon.svg']) {
    const r = await fetch(`http://localhost:${PORT}/${f}`); types[f] = r.status + ' ' + r.headers.get('content-type');
  }
  check('Every file type is served with a correct content type (HTML, CSS, JS, WOFF2, WebP, JPEG, SVG)',
    /^200 text\/html/.test(types['index.html']) && /^200 text\/css/.test(types['css/styles.css']) && /^200 text\/javascript/.test(types['js/main.js']) && /^200 font\/woff2/.test(types['assets/fonts/dmsans-normal-latin.woff2']) && /^200 image\/webp/.test(types['assets/images/hero-864.webp']) && /^200 image\/jpeg/.test(types['assets/images/og-image.jpg']) && /^200 image\/svg/.test(types['assets/icons/favicon.svg']), JSON.stringify(types));
  const trav = await fetch(`http://localhost:${PORT}/..%2f..%2f..%2fWindows%2fwin.ini`).catch(() => ({ status: 0 }));
  check('The preview server refuses to serve files outside the template folder', trav.status === 403 || trav.status === 404, String(trav.status));

  const browser = await launch();
  const URL = `http://localhost:${PORT}/index.html`;
  try {
    section('S2. The extracted site loads cleanly');
    for (const [w, h, mobile] of [[1280, 800, false], [390, 844, true]]) {
      const p = await open(browser, { url: URL, width: w, height: h, mobile, settle: 800 });
      await scrollThrough(p);
      const s = await p.evaluate(() => ({
        h1: (document.querySelector('h1') || {}).textContent, ready: document.documentElement.classList.contains('js-ready'),
        brokenImgs: [...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.getAttribute('src')),
        imgCount: document.images.length,
        emptyBinds: [...document.querySelectorAll('[data-bind]')].filter(n => !n.textContent.trim() && n.offsetParent).map(n => n.getAttribute('data-bind')),
        fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, '')),
        placeholderAlts: [...document.querySelectorAll('.hero img, .story img, .person img, .gallery img, .finale img')].filter(i => /placeholder image/i.test(i.alt)).length,
        contentImgs: [...document.querySelectorAll('.hero img, .story img, .person img, .gallery img, .finale img')].length,
        days: (document.querySelector('[data-unit=days]') || {}).textContent,
      }));
      check(`${w}px: page renders its content (h1 "${s.h1}", countdown shows ${s.days} days, js-ready)`, !!s.h1 && s.ready && /^\d+$/.test((s.days || '').trim()));
      check(`${w}px: all ${s.imgCount} images load`, s.brokenImgs.length === 0, JSON.stringify(s.brokenImgs));
      check(`${w}px: both bundled font families actually loaded`, s.fonts.some(f => /Cormorant/.test(f)) && s.fonts.some(f => /DM Sans/.test(f)), JSON.stringify([...new Set(s.fonts)]));
      check(`${w}px: no empty text slots`, s.emptyBinds.length === 0, JSON.stringify(s.emptyBinds));
      if (!demoPhotos) check(`${w}px: every content picture carries the "Placeholder image" description (nothing describes a photo that is not there)`, s.placeholderAlts === s.contentImgs && s.contentImgs >= 10, `${s.placeholderAlts}/${s.contentImgs}`);
      const r = await overflowReport(p);
      check(`${w}px: no horizontal overflow`, r.docScroll <= r.vw && r.offenders.length === 0, JSON.stringify(r));
      check(`${w}px: no console errors or unexpected warnings, no failed requests`, p.errors.length === 0 && p.warns.length === 0 && p.bad.length === 0, JSON.stringify({ e: p.errors, w: p.warns, bad: p.bad }));
      await p.close();
    }

    section('S3. RSVP honesty in the shipped state');
    {
      const p = await open(browser, { url: URL, width: 1280, height: 900, settle: 600 });
      const notice = await p.evaluate(() => (document.querySelector('.rsvp__demo-notice') || {}).textContent || '');
      check('The form shows a visible demo-mode notice before anyone fills it in', /demo/i.test(notice) && /not store|does not store|nothing/i.test(notice), notice);
      await p.type('#rsvp-name', 'Test Guest'); await p.type('#rsvp-email', 'test@example.org');
      await p.evaluate(() => document.querySelector('input[name=attendance][value=accepts]').click());
      await p.evaluate(() => document.querySelector('[data-submit]').click()); await sleep(1800);
      const out = await p.evaluate(() => ({ shown: !document.querySelector('[data-rsvp-success]').hidden, demo: (document.querySelector('[data-success-demo]') || {}).textContent || '', sent: [...performance.getEntriesByType('resource')].filter(e => e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest').length }));
      check('Submitting shows a success screen that says plainly nothing was stored or sent', out.shown && /not stored|not sent|demonstration/i.test(out.demo), out.demo);
      check('Demo submission makes no network request at all', out.sent === 0, String(out.sent));
      await p.close();
    }

    section('S4. Opening index.html straight from disk (file://)');
    {
      const p = await open(browser, { url: 'file:///' + path.join(pkg, 'index.html').replace(/\\/g, '/'), width: 1280, height: 800, settle: 800 });
      const s = await p.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent, ready: document.documentElement.classList.contains('js-ready'), fonts: [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, '')))] }));
      check('Double-clicking index.html in Chrome renders the page with its content', !!s.h1 && s.ready, JSON.stringify(s));
      check('...and without uncaught errors', p.errors.filter(e => /pageerror/.test(e)).length === 0, JSON.stringify(p.errors.slice(0, 3)));
      note('file:// console messages (Chrome blocks font PRELOAD hints from disk; harmless and documented): ' + p.errors.length);
      await p.close();
    }
  } finally { browser.__closing = true; await browser.close(); cleanup(); }
  finish();
})().catch(e => { console.error('ZIP SMOKE CRASHED', e); cleanup(); process.exit(2); });

function cleanup() {
  try { if (server) execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* already gone */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}
function finish() { process.exitCode = summary() ? 1 : 0; }
