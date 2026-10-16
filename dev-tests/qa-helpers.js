/* Shared helpers for the QA scripts (qa-a.js, qa-b.js, qa-c.js). Developer-only; not shipped to customers. */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/index.html';
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra !== undefined && extra !== '' ? '  -> ' + extra : ''));
};
const note = text => console.log('NOTE  ' + text);
const section = title => console.log('\n=== ' + title + ' ===');

function summary() {
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name)); }
  return failed.length;
}

const launch = () => puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

/* The template deliberately logs one console.warn in demo mode; anything else is unexpected. */
const EXPECTED_WARN = /RSVP is in demo mode/;

async function open(browser, o = {}) {
  const {
    width = 1280, height = 900, mobile = false, dpr = 1, reducedMotion = false, js = true,
    configPatch = '', hash = '', routes = null, blockImages = false, blockConfig = false, blockFonts = false,
    initScript = null, timezone = null, media = [], settle = 450, url = BASE
  } = o;
  const page = await browser.newPage();
  page.errors = []; page.warns = []; page.bad = []; page.urls = [];
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') page.errors.push(m.text());
    else if ((t === 'warn' || t === 'warning') && !EXPECTED_WARN.test(m.text())) page.warns.push(m.text());
  });
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('error', e => console.log('NOTE  renderer crash reported by Chrome: ' + e.message));
  if (!browser.__watched) { browser.__watched = true; browser.once('disconnected', () => { if (!browser.__closing) console.log('NOTE  browser connection closed unexpectedly'); }); }
  page.on('response', r => { if (r.status() >= 400) page.bad.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => page.bad.push('failed ' + r.url()));
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: dpr });
  const features = [...media];
  if (reducedMotion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (features.length) {
    // Puppeteer's helper rejects some features (forced-colors), so talk to Chrome directly.
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', { features });
  }
  if (timezone) await page.emulateTimezone(timezone);
  if (!js) await page.setJavaScriptEnabled(false);
  if (initScript) await page.evaluateOnNewDocument(initScript);

  await page.setRequestInterception(true);
  page.on('request', async req => {
    const u = req.url();
    page.urls.push(u);
    try {
      if (routes && await routes(req)) return;
      if (blockConfig && /\/js\/config\.js/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
      if (blockImages && /\.(webp|jpe?g|png|gif)(\?|$)/.test(u)) return req.abort();
      if (blockFonts && /\.woff2?(\?|$)/.test(u)) return req.abort();
      if (configPatch && /\/js\/config\.js/.test(u)) {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8') + '\n' + configPatch;
        return req.respond({ status: 200, contentType: 'application/javascript', body: src });
      }
      return req.continue();
    } catch (e) { /* request already handled */ }
  });

  await page.goto(url === BASE ? BASE + hash : url, { waitUntil: 'networkidle0', timeout: 45000 });
  await sleep(settle);
  return page;
}

/* Scroll the whole page so every lazy image and reveal animation has been triggered, then return to the top. */
async function scrollThrough(page, back = true) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
    await new Promise(r => setTimeout(r, 900));
  });
  if (back) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); }
}

/* Same logic as functional.js: anything poking outside the viewport (except deliberately hidden/clipped things). */
const overflowReport = page => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach(el => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    if (el.closest('.svg-sprite, .hp, .sr-only, .skip-link, dialog:not([open]), .site-nav__panel:not(.is-open), .media')) return;
    if (b.right > vw + 1 || b.left < -1) offenders.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
  });
  return { docScroll: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 8) };
});

const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('a, button, input, select, textarea, summary')].filter(e => {
  const b = e.getBoundingClientRect();
  return b.width && b.height && (b.height < 24 || b.width < 24) && !e.closest('.hp, .svg-sprite') && !e.matches('.choice__option input') && !e.closest('.faq__panel-inner');
}).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20)));

module.exports = { puppeteer, fs, path, CHROME, BASE, ROOT, sleep, check, note, section, summary, launch, open, scrollThrough, overflowReport, smallTargets, results };
