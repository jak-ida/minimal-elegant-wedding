const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = (process.env.BASE_URL || 'http://127.0.0.1:8123/index.html');
const widths = (process.argv[2] || '1440,390').split(',').map(Number);
const out = process.argv[3] || require('path').join(__dirname, 'output');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  for (const w of widths) {
    const page = await browser.newPage();
    const errors = [], failed = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => failed.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    await page.setViewport({ width: w, height: w >= 900 ? 900 : 800, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2800));
    await page.screenshot({ path: `${out}/${w}-fold.png` });
    // scroll through to trigger reveals
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 400) { await page.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 120)); }
    await new Promise(r => setTimeout(r, 1800));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 400));
    const metrics = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, height: document.documentElement.scrollHeight
    }));
    console.log(`width ${w}:`, JSON.stringify(metrics), 'errors:', errors, 'failed:', failed);
    // full page in slices to keep images readable
    const sliceH = 1400;
    for (let i = 0, y = 0; y < metrics.height; i++, y += sliceH) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await new Promise(r => setTimeout(r, 250));
      await page.screenshot({ path: `${out}/${w}-p${String(i).padStart(2, '0')}.png`, clip: { x: 0, y, width: w, height: Math.min(sliceH, metrics.height - y) }, captureBeyondViewport: true });
    }
    await page.close();
  }
  await browser.close();
})();
