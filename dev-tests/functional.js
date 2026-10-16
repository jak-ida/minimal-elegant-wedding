const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8123/index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra !== undefined ? '  -> ' + extra : '')); };

async function open(browser, { width = 1280, height = 900, mobile = false, configPatch, reducedMotion, js = true } = {}) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror ' + e.message));
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (!js) await page.setJavaScriptEnabled(false);
  if (configPatch) {
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (req.url().endsWith('/js/config.js') && typeof configPatch === 'string') {
        const fs = require('fs');
        let src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'config.js'), 'utf8');
        src += '\n' + configPatch;
        req.respond({ status: 200, contentType: 'application/javascript', body: src });
      } else req.continue();
    });
  }
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(400);
  page.logs = logs;
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });

  /* ---------- Structure, links, images ---------- */
  {
    const page = await open(browser);
    check('No console errors on load', page.logs.length === 0, JSON.stringify(page.logs));
    const links = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const h = a.getAttribute('href');
        if (h === '#' || h === '') bad.push('empty:' + a.textContent.trim());
        else if (h.startsWith('#') && !document.getElementById(h.slice(1))) bad.push('missing:' + h);
      });
      const total = document.querySelectorAll('a[href^="#"]').length;
      const ext = [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).length;
      return { bad, total, ext };
    });
    check('All internal anchors resolve and none are "#"', links.bad.length === 0, `${links.total} internal links; problems: ${JSON.stringify(links.bad)}`);
    check('External links use rel="noopener noreferrer"', links.ext === 0);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
    await sleep(800);
    const imgs = await page.evaluate(() => [...document.images].map(i => ({ src: i.currentSrc.split('/').slice(-1)[0], ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.loading })));
    check('All images loaded (' + imgs.length + ')', imgs.every(i => i.ok), JSON.stringify(imgs.filter(i => !i.ok)));
    const contentImgs = imgs.filter(i => !/base64/.test(i.src)); // ignore the lightbox's 1px placeholder
    check('Every content image has alt text and dimensions', contentImgs.every(i => i.alt && i.w && i.h), JSON.stringify(contentImgs.filter(i => !(i.alt && i.w && i.h))));
    const h1s = await page.evaluate(() => document.querySelectorAll('h1').length);
    check('Exactly one h1', h1s === 1);
    const headingOrder = await page.evaluate(() => { let prev = 0, jumps = []; document.querySelectorAll('h1,h2,h3,h4').forEach(h => { const l = +h.tagName[1]; if (l - prev > 1) jumps.push(h.textContent.trim() + ' ' + h.tagName); prev = l; }); return jumps; });
    check('No skipped heading levels', headingOrder.length === 0, JSON.stringify(headingOrder));
    const heroLazy = await page.evaluate(() => document.querySelector('.hero__image').loading);
    check('Hero image is not lazy-loaded', heroLazy !== 'lazy', heroLazy);
    await page.close();
  }

  /* ---------- Countdown ---------- */
  {
    const page = await open(browser);
    const readTimer = () => page.evaluate(() => [...document.querySelectorAll('[data-unit]')].map(n => n.textContent).join(':'));
    const a = await readTimer(); await sleep(2100); const b = await readTimer();
    check('Countdown updates every second', a !== b, `${a} -> ${b}`);
    const widths = [];
    for (let i = 0; i < 6; i++) { widths.push(await page.evaluate(() => { const r = document.querySelector('.countdown__timer').getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10].join('x'); })); await sleep(700); }
    check('Countdown box does not change size as digits change', new Set(widths).size === 1, widths.join(' '));
    const live = await page.evaluate(() => { const s = document.querySelector('[data-countdown-summary]'); return { text: s.textContent, live: s.getAttribute('aria-live'), hiddenNumbers: [...document.querySelectorAll('[data-unit]')].every(n => n.getAttribute('aria-hidden') === 'true') }; });
    check('Screen-reader summary exists, not a live region, numbers aria-hidden', live.text.length > 10 && !live.live && live.hiddenNumbers, live.text);
    await page.close();

    const soon = await open(browser, { configPatch: `window.WEDDING_CONFIG.wedding.dateTime = new Date(Date.now()+4000).toISOString().slice(0,19).replace('Z','')+'+00:00';` });
    await sleep(5500);
    const fin = await soon.evaluate(() => ({ msg: document.querySelector('[data-countdown-message]').textContent, shown: !document.querySelector('[data-countdown-message]').hidden, timerHidden: document.querySelector('[data-countdown]').hidden }));
    check('Countdown finish message appears when time is reached', fin.shown && fin.timerHidden && /married/i.test(fin.msg), fin.msg);
    await soon.close();

    const past = await open(browser, { configPatch: `window.WEDDING_CONFIG.wedding.dateTime = "2020-05-02T12:00:00";` });
    const pm = await past.evaluate(() => ({ msg: document.querySelector('[data-countdown-message]').textContent, shown: !document.querySelector('[data-countdown-message]').hidden }));
    check('Past date handled gracefully', pm.shown && /2 May 2020/.test(pm.msg), pm.msg);
    check('Past-date page has no errors', past.logs.length === 0, JSON.stringify(past.logs));
    await past.close();

    const bad = await open(browser, { configPatch: `window.WEDDING_CONFIG.wedding.dateTime = "not a date";` });
    check('Invalid date does not break the page (hero still renders names)', await bad.evaluate(() => document.querySelector('.hero__name--one').textContent === 'Amara'));
    await bad.close();
  }

  /* ---------- Navigation: desktop + mobile ---------- */
  {
    const page = await open(browser, { width: 390, height: 800, mobile: true });
    const toggle = '[data-menu-toggle]';
    const state = () => page.evaluate(() => { const t = document.querySelector('[data-menu-toggle]'); const p = document.querySelector('[data-menu-panel]'); return { exp: t.getAttribute('aria-expanded'), controls: t.getAttribute('aria-controls'), panelId: p.id, vis: getComputedStyle(p).visibility }; });
    let s = await state();
    check('Mobile menu starts closed (aria-expanded=false, panel hidden)', s.exp === 'false' && s.vis === 'hidden');
    check('aria-controls matches panel id', s.controls === s.panelId, s.controls);
    await page.click(toggle); await sleep(400); s = await state();
    check('Menu opens on click', s.exp === 'true' && s.vis === 'visible');
    await page.keyboard.press('Escape'); await sleep(400); s = await state();
    const focusOnToggle = await page.evaluate(() => document.activeElement.matches('[data-menu-toggle]'));
    check('Escape closes menu and returns focus to the toggle', s.exp === 'false' && focusOnToggle);
    await page.click(toggle); await sleep(400);
    await page.click('.site-nav__list a[href="#gallery"]'); await sleep(1500); s = await state();
    const y = await page.evaluate(() => document.getElementById('gallery').getBoundingClientRect().top);
    check('Selecting a link closes the menu', s.exp === 'false');
    check('Section scrolls into view below the sticky header', y >= 0 && y < 160, 'gallery top = ' + Math.round(y) + 'px');
    await page.click(toggle); await sleep(300);
    await page.mouse.click(200, 760); await sleep(300); s = await state();
    check('Click outside closes the menu', s.exp === 'false');
    check('No console errors during navigation tests', page.logs.length === 0, JSON.stringify(page.logs));
    await page.close();

    const d = await open(browser, { width: 1280 });
    const dd = await d.evaluate(() => ({ toggleHidden: getComputedStyle(document.querySelector('[data-menu-toggle]')).display === 'none', links: [...document.querySelectorAll('.site-nav__list a')].map(a => a.textContent.trim()) }));
    check('Desktop nav shows all links, hides the menu button', dd.toggleHidden && dd.links.join('|') === 'Our Story|Wedding Details|Gallery|FAQs|RSVP', dd.links.join('|'));
    const sticky = await d.evaluate(async () => { window.scrollTo(0, 2000); await new Promise(r => setTimeout(r, 300)); return document.querySelector('.site-header').getBoundingClientRect().top; });
    check('Header stays pinned at top while scrolling', sticky === 0, sticky);
    await d.close();
  }

  /* ---------- Banner ---------- */
  {
    const page = await open(browser);
    const before = await page.evaluate(() => !!document.querySelector('.banner') && getComputedStyle(document.querySelector('.banner')).display !== 'none');
    await page.click('[data-banner-close]'); await sleep(300);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.banner')).display);
    check('Banner shows and can be dismissed', before && after === 'none');
    await page.reload({ waitUntil: 'networkidle0' });
    const stay = await page.evaluate(() => getComputedStyle(document.querySelector('.banner')).display);
    check('Dismissed banner stays hidden after reload (same session)', stay === 'none');
    await page.close();
  }

  /* ---------- FAQ ---------- */
  {
    const page = await open(browser);
    const t0 = '#faq-trigger-0';
    await page.evaluate(() => document.getElementById('faq').scrollIntoView());
    await sleep(900);
    let st = await page.$eval(t0, e => e.getAttribute('aria-expanded'));
    check('FAQ starts collapsed', st === 'false');
    await page.focus(t0); await page.keyboard.press('Enter'); await sleep(500);
    st = await page.$eval(t0, e => e.getAttribute('aria-expanded'));
    const vis = await page.$eval('#faq-panel-0', e => getComputedStyle(e).visibility);
    check('Enter key expands an item (aria-expanded=true, panel visible)', st === 'true' && vis === 'visible');
    await page.keyboard.press('Space'); await sleep(500);
    st = await page.$eval(t0, e => e.getAttribute('aria-expanded'));
    check('Space key collapses it again', st === 'false');
    await page.keyboard.press('ArrowDown');
    const f = await page.evaluate(() => document.activeElement.id);
    check('Arrow Down moves focus to next question', f === 'faq-trigger-1', f);
    const attrs = await page.evaluate(() => { const b = document.getElementById('faq-trigger-2'); const p = document.getElementById(b.getAttribute('aria-controls')); return { role: p.getAttribute('role'), lb: p.getAttribute('aria-labelledby') === b.id, tag: b.tagName }; });
    check('ARIA wiring (button, controls, region, labelledby)', attrs.tag === 'BUTTON' && attrs.role === 'region' && attrs.lb);
    const mail = await page.evaluate(() => !!document.querySelector('#faq-panel-1 a[href^="mailto:"]') && document.querySelector('#faq-panel-4').textContent.includes('1 May 2027'));
    check('FAQ {contact} becomes mailto link and {deadline} is filled', mail);
    await page.close();
  }

  /* ---------- Lightbox ---------- */
  {
    const page = await open(browser);
    await page.evaluate(() => document.getElementById('gallery').scrollIntoView());
    await sleep(1500);
    const btnSel = '.gallery__item:nth-child(2) .gallery__button';
    await page.focus(btnSel);
    await page.keyboard.press('Enter'); await sleep(600);
    let s = await page.evaluate(() => ({ open: document.querySelector('dialog').open, count: document.querySelector('[data-lightbox-count]').textContent, locked: getComputedStyle(document.documentElement).overflow, alt: document.querySelector('[data-lightbox-image]').alt.slice(0, 30), focus: document.activeElement.getAttribute('aria-label') }));
    check('Enter on a thumbnail opens the lightbox', s.open, JSON.stringify(s));
    check('Background scroll is locked', s.locked === 'hidden');
    check('Focus moves inside the dialog (close button)', /Close/.test(s.focus), s.focus);
    await page.keyboard.press('ArrowRight'); await sleep(300);
    let c1 = await page.$eval('[data-lightbox-count]', e => e.textContent);
    await page.keyboard.press('ArrowLeft'); await sleep(300);
    let c2 = await page.$eval('[data-lightbox-count]', e => e.textContent);
    check('Arrow keys navigate', c1 === '3 / 7' && c2 === '2 / 7', c1 + ' / ' + c2);
    await page.click('[data-lightbox-next]'); await sleep(300);
    check('Next button works', (await page.$eval('[data-lightbox-count]', e => e.textContent)) === '3 / 7');
    await page.click('[data-lightbox-prev]'); await sleep(300);
    check('Previous button works', (await page.$eval('[data-lightbox-count]', e => e.textContent)) === '2 / 7');
    // wraps
    for (let i = 0; i < 6; i++) await page.click('[data-lightbox-prev]');
    check('Navigation wraps around', (await page.$eval('[data-lightbox-count]', e => e.textContent)) === '3 / 7');
    const tabOrder = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); tabOrder.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.tagName)); }
    check('Focus stays trapped inside the dialog while tabbing', tabOrder.every(l => /Close|Previous|Next|DIALOG|BODY/.test(l)), tabOrder.join(' > '));
    await page.keyboard.press('Escape'); await sleep(500);
    s = await page.evaluate(() => ({ open: document.querySelector('dialog').open, focus: document.activeElement.className, locked: getComputedStyle(document.documentElement).overflow }));
    check('Escape closes the lightbox', !s.open);
    check('Focus returns to the thumbnail that opened it', /gallery__button/.test(s.focus), s.focus);
    check('Scroll lock released', s.locked !== 'hidden');
    // click outside
    await page.click(btnSel); await sleep(600);
    await page.mouse.click(8, 8); await sleep(500); // dark margin, clear of every button and the photo
    check('Clicking the dark area outside the photo closes it', !(await page.evaluate(() => document.querySelector('dialog').open)));
    check('No console errors in lightbox tests', page.logs.length === 0, JSON.stringify(page.logs));
    await page.close();
  }

  /* ---------- RSVP ---------- */
  {
    const page = await open(browser);
    await page.evaluate(() => document.getElementById('rsvp').scrollIntoView());
    await sleep(1200);
    check('Demo notice visible on localhost in demo mode', await page.evaluate(() => !document.querySelector('[data-demo-notice]').hidden));
    await page.click('[data-submit]'); await sleep(200);
    let errs = await page.evaluate(() => [...document.querySelectorAll('.field__error:not([hidden])')].map(e => e.textContent));
    check('Empty submit shows errors for name, email and attendance', errs.length === 3, JSON.stringify(errs));
    const firstFocus = await page.evaluate(() => document.activeElement.name);
    check('Focus moves to the first invalid field', firstFocus === 'name', firstFocus);
    const invalidAttr = await page.evaluate(() => document.querySelector('#rsvp-name').getAttribute('aria-invalid'));
    check('Invalid field gets aria-invalid', invalidAttr === 'true');
    await page.type('#rsvp-name', 'Zoë Thompson');
    await page.type('#rsvp-email', 'not-an-email'); await page.click('[data-submit]'); await sleep(200);
    errs = await page.evaluate(() => [...document.querySelectorAll('.field__error:not([hidden])')].map(e => e.textContent));
    check('Invalid email is rejected with helpful message', errs.some(e => /email/i.test(e)) && errs.length === 2, JSON.stringify(errs));
    await page.click('#rsvp-email', { clickCount: 3 }); await page.type('#rsvp-email', 'zoe@example.org');
    const guestsHidden = await page.evaluate(() => document.querySelector('[data-accept-only]').hidden);
    check('Guest/dietary fields hidden until "accepts" selected', guestsHidden);
    await page.click('input[value="accepts"] + .choice__box'); await sleep(100);
    const opts = await page.$$eval('#rsvp-guests option', o => o.map(x => x.value));
    check('Guest count options limited to configured maximum (4)', opts.join(',') === '1,2,3,4', opts.join(','));
    await page.select('#rsvp-guests', '3');
    await page.type('#rsvp-dietary', 'Vegetarian');
    await page.click('[data-submit]'); await sleep(150);
    const loading = await page.evaluate(() => ({ dis: document.querySelector('[data-submit]').disabled, txt: document.querySelector('.btn__label').textContent, busy: document.querySelector('[data-submit]').getAttribute('aria-busy') }));
    check('Loading state: button disabled, label changes, aria-busy', loading.dis && /Sending/.test(loading.txt) && loading.busy === 'true', JSON.stringify(loading));
    await sleep(1200);
    const ok = await page.evaluate(() => ({ formHidden: document.querySelector('[data-rsvp-form]').hidden, title: document.querySelector('[data-success-title]').textContent, demo: document.querySelector('[data-success-demo]').textContent, focus: document.activeElement.hasAttribute('data-rsvp-success'), summary: document.querySelector('[data-success-summary]').textContent }));
    check('Success state shown with focus moved to it', ok.formHidden && /Zoë/.test(ok.title) && ok.focus, ok.title);
    check('Demo success says nothing was stored or sent', /not stored or sent/i.test(ok.demo), ok.demo);
    check('Success summary lists guests and dietary needs', /3/.test(ok.summary) && /Vegetarian/.test(ok.summary));
    await page.click('[data-rsvp-reset]'); await sleep(200);
    check('"Send another response" restores an empty form', await page.evaluate(() => !document.querySelector('[data-rsvp-form]').hidden && document.querySelector('#rsvp-name').value === ''));
    // declines path
    await page.type('#rsvp-name', 'Sam Lee'); await page.type('#rsvp-email', 'sam@example.org');
    await page.click('input[value="declines"] + .choice__box'); await page.click('[data-submit]'); await sleep(1200);
    check('Declining works without guest count', await page.evaluate(() => /miss you/.test(document.querySelector('[data-success-text]').textContent)));
    check('No console errors in RSVP demo tests', page.logs.length === 0, JSON.stringify(page.logs));
    await page.close();
  }

  /* ---------- RSVP production adapter (mocked endpoint) ---------- */
  for (const scenario of ['success', 'server-error', 'network-fail', 'reported-error']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const sent = [];
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.endsWith('/js/config.js')) {
        const fs = require('fs');
        let src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'config.js'), 'utf8');
        src += `\nwindow.WEDDING_CONFIG.rsvp.mode='production'; window.WEDDING_CONFIG.rsvp.endpoint='https://rsvp.example-service.test/submit'; window.WEDDING_CONFIG.rsvp.format='${scenario === 'success' ? 'json' : 'form'}';`;
        req.respond({ status: 200, contentType: 'application/javascript', body: src });
      } else if (u.startsWith('https://rsvp.example-service.test')) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        sent.push({ method: req.method(), type: req.headers()['content-type'], body: req.postData() });
        const cors = { 'access-control-allow-origin': '*' };
        if (scenario === 'success') req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' });
        else if (scenario === 'server-error') req.respond({ status: 500, headers: cors, contentType: 'application/json', body: '{"error":"boom"}' });
        else if (scenario === 'reported-error') req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"Invalid"}' });
        else req.abort('failed');
      } else req.continue();
    });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await sleep(300);
    const noticeHidden = await page.evaluate(() => document.querySelector('[data-demo-notice]').hidden);
    await page.evaluate(() => document.getElementById('rsvp').scrollIntoView()); await sleep(1000);
    await page.type('#rsvp-name', 'Ada Lovelace'); await page.type('#rsvp-email', 'ada@example.org');
    await page.click('input[value="accepts"] + .choice__box'); await page.select('#rsvp-guests', '2');
    await page.click('[data-submit]'); await sleep(1500);
    const r = await page.evaluate(() => ({ success: !document.querySelector('[data-rsvp-success]').hidden, err: document.querySelector('[data-form-error]').hidden ? '' : document.querySelector('[data-form-error]').textContent, demoVisible: !document.querySelector('[data-success-demo]').hidden, btnEnabled: !document.querySelector('[data-submit]').disabled }));
    if (scenario === 'success') {
      check('Production mode: POSTs JSON to the https endpoint', sent.length === 1 && sent[0].method === 'POST' && /json/.test(sent[0].type), JSON.stringify(sent[0] && { m: sent[0].method, t: sent[0].type }));
      const body = JSON.parse(sent[0].body);
      check('Payload contains expected fields, no secrets', ['name', 'email', 'attendance', 'guests', 'dietary', 'message', 'submittedAt'].every(k => k in body) && body.guests === '2', JSON.stringify(Object.keys(body)));
      check('Production success shows success without the demo disclaimer', r.success && !r.demoVisible);
      check('Demo notice hidden in production mode', noticeHidden);
    } else {
      check(`Production mode "${scenario}": shows an error, keeps form, re-enables button`, !r.success && /could not send/i.test(r.err) && r.btnEnabled, r.err);
    }
    await page.close();
  }

  /* ---------- Misconfigured production mode falls back safely ---------- */
  {
    const page = await open(browser, { configPatch: `window.WEDDING_CONFIG.rsvp.mode='production'; window.WEDDING_CONFIG.rsvp.endpoint='http://insecure.example.com/x';` });
    const notice = await page.evaluate(() => document.querySelector('[data-demo-notice]').textContent);
    check('Non-https endpoint is refused and demo-mode notice explains why', /no valid https endpoint/i.test(notice), notice);
    await page.close();
  }

  /* ---------- Reduced motion ---------- */
  {
    const page = await open(browser, { reducedMotion: true });
    const r = await page.evaluate(() => {
      const hidden = [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity === '0' && !e.classList.contains('is-visible')).length;
      const heroText = getComputedStyle(document.querySelector('.hero__title')).opacity;
      return { hidden, heroText, smooth: getComputedStyle(document.documentElement).scrollBehavior, total: document.querySelectorAll('[data-reveal]').length };
    });
    check('Reduced motion: nothing is left hidden, no smooth scrolling', r.hidden === 0 && r.heroText === '1' && r.smooth === 'auto', JSON.stringify(r));
    await page.close();

    const nm = await open(browser, {});
    const sm = await nm.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    check('Normal motion: smooth scrolling enabled', sm === 'smooth', sm);
    await nm.close();
  }

  /* ---------- Reveal fail-safe + JS disabled ---------- */
  {
    const page = await open(browser, { js: false });
    const r = await page.evaluate(() => ({ navVisible: getComputedStyle(document.querySelector('.site-nav__panel')).visibility, hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length, heroImg: document.querySelector('.hero__image').naturalWidth > 0, noscript: !!document.querySelector('noscript') }));
    check('JS disabled: nothing hidden by animation CSS, nav links visible, hero photo shows', r.hiddenReveal === 0 && r.navVisible === 'visible' && r.heroImg, JSON.stringify(r));
    await page.close();

    const page2 = await browser.newPage();
    await page2.setRequestInterception(true);
    page2.on('request', req => req.url().endsWith('/js/main.js') ? req.respond({ status: 200, contentType: 'application/javascript', body: 'throw new Error("simulated failure")' }) : req.continue());
    await page2.setViewport({ width: 1280, height: 900 });
    await page2.goto(BASE, { waitUntil: 'networkidle0' });
    await sleep(4600);
    const hiddenAfter = await page2.evaluate(() => ({ jsClass: document.documentElement.classList.contains('js'), hidden: [...document.querySelectorAll('[data-reveal], .hero__text > *')].filter(e => getComputedStyle(e).opacity === '0').length }));
    check('main.js failure: "js" class removed after 4s so no content stays hidden', !hiddenAfter.jsClass && hiddenAfter.hidden === 0, JSON.stringify(hiddenAfter));
    await page2.close();
  }

  /* ---------- Opening index.html straight from disk (file://) ---------- */
  {
    const page = await browser.newPage();
    const errs = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('file:///' + require('path').join(__dirname, '..', 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await sleep(600);
    const r = await page.evaluate(() => ({ ready: document.documentElement.classList.contains('js-ready'), name: document.querySelector('.hero__name--one').textContent, gallery: document.querySelectorAll('.gallery__item').length, fonts: [...document.fonts].filter(f => f.status === 'loaded').length }));
    // Known, harmless: Chrome refuses the two crossorigin font *preload hints* from a file:// page (origin "null").
    // The @font-face rules still load the fonts (checked below). Anything else counts as a real error.
    const isPreloadNoise = s => /woff2|ERR_FAILED/.test(s);
    const realErrs = errs.filter(s => !isPreloadNoise(s));
    const realFailed = failed.filter(u => !/\.woff2$/.test(u));
    check('file:// (double-click) works: content renders, no errors apart from font-preload noise', r.ready && r.name === 'Amara' && r.gallery === 7 && realErrs.length === 0 && realFailed.length === 0, JSON.stringify({ r, realErrs, realFailed }));
    const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('64px "Cormorant Garamond"') && document.fonts.check('16px "DM Sans"') && [...document.fonts].some(f => f.family === 'DM Sans' && f.status === 'loaded'); });
    check('file:// still renders the self-hosted fonts (preload noise is cosmetic)', fontOk, 'preload console messages seen: ' + errs.length);
    await page.close();
  }

  /* ---------- Keyboard: every focusable element shows a visible focus indicator ---------- */
  {
    const page = await open(browser, { width: 1280 });
    await sleep(500);
    const problems = [];
    let count = 0;
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const cs = getComputedStyle(e); const target = e.matches('.choice__option input') ? e.nextElementSibling : e;
        const ts = getComputedStyle(target);
        const visible = (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') || (parseFloat(ts.outlineWidth) > 0 && ts.outlineStyle !== 'none') || cs.boxShadow !== 'none';
        return { name: (e.getAttribute('aria-label') || e.textContent || e.name || e.tagName).trim().slice(0, 28), visible, tag: e.tagName };
      });
      if (info) { count++; if (!info.visible) problems.push(info.name); }
    }
    check(`Keyboard focus is visible on all ${count} tab stops checked`, count > 30 && problems.length === 0, JSON.stringify(problems));
    await page.close();
  }

  /* ---------- Responsive overflow at all required widths ---------- */
  for (const w of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    const page = await open(browser, { width: w, height: 900, mobile: w < 800 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } });
    await sleep(500);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      document.querySelectorAll('body *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        if (el.closest('.svg-sprite, .hp, .sr-only, .skip-link, dialog:not([open]), .site-nav__panel:not(.is-open), .media')) return;
        if (b.right > vw + 1 || b.left < -1) offenders.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
      });
      const small = [...document.querySelectorAll('a, button, input, select, textarea, summary')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && (b.height < 24 || b.width < 24) && !e.closest('.hp, .svg-sprite') && !e.matches('.choice__option input') && !e.closest('.faq__panel-inner'); }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20));
      return { docScroll: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 6), small };
    });
    check(`${w}px: no horizontal overflow, nothing clipped outside viewport`, r.docScroll <= r.vw && r.offenders.length === 0, JSON.stringify(r.offenders));
    check(`${w}px: no tiny (<24px) touch targets`, r.small.length === 0, JSON.stringify(r.small));
    await page.close();
  }

  /* ---------- Long names ---------- */
  {
    const page = await open(browser, { width: 320, configPatch: `window.WEDDING_CONFIG.couple.partnerOne='Alexandrina-Konstantina'; window.WEDDING_CONFIG.couple.partnerTwo='Bartholomew Christopherson';` });
    const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, v: document.documentElement.clientWidth, h1w: Math.round(document.querySelector('.hero__title').getBoundingClientRect().right) }));
    check('Very long names at 320px stay inside the viewport', r.s <= r.v && r.h1w <= r.v, JSON.stringify(r));
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name)); }
})();

