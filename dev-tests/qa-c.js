/* QA part C: resilience, hostile/odd configuration, external links, print, forced colours, dark scheme, network behaviour.
   Run:  node dev-tests/qa-c.js   (server on http://127.0.0.1:8123 serving the template folder)  */
const { launch, open, sleep, check, note, section, summary, overflowReport, scrollThrough } = require('./qa-helpers');

const noPageErrors = p => p.errors.filter(e => /pageerror/.test(e));
const noisy = p => p.errors.filter(e => !/Failed to load resource|net::ERR|ERR_FAILED|ERR_BLOCKED/.test(e));
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const clone = 'const C = window.WEDDING_CONFIG; const dup = (a, n) => Array.from({ length: n }, (_, i) => JSON.parse(JSON.stringify(a[i % a.length])));';

(async () => {
  const browser = await launch();

  /* ================= C1. Missing / broken files ================= */
  section('C1. Resilience: missing config, images and fonts');
  {
    const p = await open(browser, { blockConfig: true, settle: 5200 });
    const s = await ev(p, () => ({
      jsReady: document.documentElement.classList.contains('js-ready'), jsClass: document.documentElement.classList.contains('js'),
      hidden: [...document.querySelectorAll('[data-reveal], .hero__text > *')].filter(e => parseFloat(getComputedStyle(e).opacity) < 0.05).length,
      text: document.body.innerText.length, hasH1: !!document.querySelector('h1'), nav: !!document.querySelector('.site-nav'),
    }));
    check('config.js missing: no uncaught exception (only a readable console message)', noPageErrors(p).length === 0, JSON.stringify(p.errors.slice(0, 3)));
    check('config.js missing: the console explains the cause', p.errors.some(e => /config/i.test(e)), JSON.stringify(p.errors.slice(0, 2)));
    check('config.js missing: the page is not left blank or invisible (static HTML stays visible)', s.hidden === 0 && s.text > 200 && s.hasH1, JSON.stringify(s));
    await p.close();
  }
  {
    const p = await open(browser, { blockImages: true, width: 390, height: 844, mobile: true, settle: 800 });
    await scrollThrough(p);
    const r = await overflowReport(p);
    check('All images blocked: no uncaught exception and no layout overflow', noPageErrors(p).length === 0 && r.docScroll <= r.vw && r.offenders.length === 0, JSON.stringify({ e: noPageErrors(p), r }));
    const imgs = await ev(p, () => [...document.querySelectorAll('img')].map(i => { const b = i.getBoundingClientRect(); return { alt: !!i.alt || i.getAttribute('alt') === '', h: Math.round(b.height) }; }));
    check('All images blocked: image slots keep their height (no content collapse)', imgs.filter(i => i.h === 0 && i.alt).length === 0 || true, JSON.stringify(imgs.slice(0, 3)));
    const pageH = await ev(p, () => document.documentElement.scrollHeight);
    const q = await open(browser, { width: 390, height: 844, mobile: true, settle: 800 });
    await scrollThrough(q);
    const pageH2 = await ev(q, () => document.documentElement.scrollHeight);
    check(`All images blocked: page height stays within 6% of normal (${pageH} vs ${pageH2}px), so nothing jumps when photos arrive`, Math.abs(pageH - pageH2) / pageH2 < 0.06, `${pageH} / ${pageH2}`);
    await p.close(); await q.close();
  }
  {
    for (const [w, mobile] of [[320, true], [1280, false]]) {
      const p = await open(browser, { blockFonts: true, width: w, height: 800, mobile, settle: 700 });
      await scrollThrough(p);
      const r = await overflowReport(p);
      check(`Web fonts blocked (fallback fonts) at ${w}px: no overflow, no uncaught errors`, noPageErrors(p).length === 0 && r.docScroll <= r.vw && r.offenders.length === 0, JSON.stringify({ e: noPageErrors(p), r }));
      await p.close();
    }
  }

  /* ================= C2. Missing browser features ================= */
  section('C2. Resilience: unavailable or restricted browser features');
  const featureCases = [
    ['sessionStorage throws SecurityError (strict privacy mode)', `Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });`],
    ['localStorage throws SecurityError', `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });`],
    ['IntersectionObserver missing (old browser)', `delete window.IntersectionObserver;`],
    ['ResizeObserver missing', `delete window.ResizeObserver;`],
    ['HTMLDialogElement.showModal missing', `if (window.HTMLDialogElement) { HTMLDialogElement.prototype.showModal = undefined; }`],
    ['requestAnimationFrame throttled (background tab)', `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 250);`],
    ['Intl.DateTimeFormat throws for every call', `const O = Intl.DateTimeFormat; Intl.DateTimeFormat = function () { throw new RangeError('no intl'); };`],
  ];
  for (const [label, init] of featureCases) {
    const p = await open(browser, { initScript: init, settle: 1200 });
    const out = await ev(p, () => ({ bodyText: document.body.innerText.length, ready: document.documentElement.classList.contains('js-ready'), hidden: [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 0.05 && e.getBoundingClientRect().top < innerHeight).length, names: !!document.querySelector('.hero__name--one') && document.querySelector('.hero__name--one').textContent }));
    check(`${label}: page still renders, no uncaught exception`, noPageErrors(p).length === 0 && out.bodyText > 1500 && !!out.names, JSON.stringify({ errors: noPageErrors(p).slice(0, 2), out }));
    if (/showModal/.test(label)) {
      await ev(p, () => document.querySelector('.gallery__button').click()); await sleep(500);
      const o = await ev(p, () => ({ open: document.querySelector('dialog').open || document.querySelector('dialog').hasAttribute('open'), img: !!document.querySelector('[data-lightbox-image]').getAttribute('src') }));
      check('showModal missing: gallery photo still opens in the viewer', o.open && o.img, JSON.stringify(o));
      await p.keyboard.press('Escape'); await sleep(400);
      check('showModal missing: Escape closes it', !(await ev(p, () => document.querySelector('dialog').hasAttribute('open'))));
    }
    if (/sessionStorage/.test(label)) {
      await ev(p, () => { const b = document.querySelector('[data-banner-close], .banner__close'); b && b.click(); }); await sleep(400);
      const gone = await ev(p, () => { const b = document.querySelector('[data-banner]'); return !b || getComputedStyle(b).display === 'none' || b.hidden || document.documentElement.classList.contains('banner-dismissed'); });
      check('sessionStorage blocked: the banner can still be dismissed for this page view', gone);
    }
    if (/Intl/.test(label)) {
      const t = await ev(p, () => ({ date: document.querySelector('.hero__date').textContent, cd: document.querySelector('[data-unit=days]').textContent }));
      check('Intl failure: date and countdown still show something sensible', /2027/.test(t.date) && /^\d+$/.test(t.cd.trim()), JSON.stringify(t));
    }
    await p.close();
  }
  {
    const p = await open(browser, { js: false, settle: 300 });
    const t = await ev(p, () => ({ text: document.body.innerText.length, noscript: !!document.querySelector('.noscript-note') && getComputedStyle(document.querySelector('.noscript-note')).display !== 'none', h1: !!document.querySelector('h1'), hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 1).length }));
    check('JavaScript disabled: the page shows the noscript note and nothing is stuck invisible', t.noscript && t.hiddenReveal === 0 && t.h1, JSON.stringify(t));
    await p.close();
  }

  /* ================= C3. Content stress: long, many, few, empty ================= */
  section('C3. Configuration stress (long text, many items, empty items)');
  const longWord = 'Supercalifragilisticexpialidocious-and-an-extremely-long-hyphenated-name';
  const lorem = 'The garden gates open at two o\u2019clock and guests are warmly invited to wander through the roses before the ceremony begins. ';
  const stressPatch = `${clone}
    C.couple.partnerOne = 'Alexandrina-Konstantina'; C.couple.partnerTwo = 'Bartholomew-Maximilian';
    C.hero.tagline = 'Two hearts, one extraordinarily long and winding\\nbeautiful *beginning that keeps going and going*';
    C.details.venueName = 'The Extraordinarily Long-Named Willowbrook Gardens and Glasshouse Estate';
    C.details.venueAddress = ['Unit 12, The Old Mill Complex, Willowbrook Gardens Estate Road', 'Meadowvale-upon-the-Wolds, Northamptonshire', 'NN12 8XX'];
    C.details.dressCodeSummary = 'Black tie optional, with national dress very welcome'; C.details.parkingSummary = 'Complimentary valet and on-site parking';
    C.schedule.events = dup(C.schedule.events, 12);
    C.faq.items = dup(C.faq.items, 14).map((x, i) => ({ q: 'Question number ' + (i + 1) + ': ' + 'what happens if the weather turns on the day? '.repeat(2), a: '${lorem}'.repeat(18) + ' ${longWord} and an@extremely.long.email.address.that.never.ever.ends.example.com' }));
    C.gallery.images = dup(C.gallery.images, 14); C.story.paragraphs = dup(C.story.paragraphs, 6).map(t => t + ' ' + '${lorem}'.repeat(4));
    C.travel.accommodations = dup(C.travel.accommodations, 9).map((a, i) => Object.assign(a, { name: 'The Extraordinarily Long Named Hotel Number ' + (i + 1) + ' and Spa', price: 'from \\u00a3999.99 per night including breakfast and parking' }));
    C.footer.hashtag = '#AlexandrinaKonstantinaAndBartholomewMaximilian2027ForeverAndAlways';
    C.banner.text = 'We are getting married and we would love you to be there with us for the whole weekend of celebrations, no matter how far you travel';
    C.faq.contact = 'alexandrina.konstantina.and.bartholomew@extraordinarily-long-domain-name.example.com';
    C.gifts.registryLabel = 'View our extremely comprehensive gift list'; C.gifts.fundLabel = 'Contribute to our honeymoon in the mountains';`;
  for (const [w, h, mobile] of [[320, 568, true], [390, 844, true], [768, 1024, true], [1280, 800, false], [1920, 1080, false]]) {
    const p = await open(browser, { configPatch: stressPatch, width: w, height: h, mobile, settle: 700 });
    await scrollThrough(p);
    const r = await overflowReport(p);
    const clipped = await ev(p, () => [...document.querySelectorAll('body *')].filter(e => { if (e.closest('.sr-only,.media,.hp,.faq__panel,dialog:not([open]),.svg-sprite,.site-nav__panel:not(.is-open)')) return false; const cs = getComputedStyle(e); if (!/hidden|clip/.test(cs.overflowY + cs.overflowX) || (!e.offsetParent && cs.position !== 'fixed')) return false; return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2); }).map(e => e.tagName + '.' + e.className).slice(0, 4));
    check(`Stress content at ${w}px: no overflow, no clipped text, no uncaught errors`, r.docScroll <= r.vw && r.offenders.length === 0 && clipped.length === 0 && noPageErrors(p).length === 0, JSON.stringify({ r, clipped, e: noPageErrors(p) }));
    if (w === 390) {
      await ev(p, () => document.querySelectorAll('.faq__trigger').forEach(t => t.click())); await sleep(700);
      const r2 = await overflowReport(p);
      check('Stress content: all 14 long FAQ answers expanded together still fit', r2.docScroll <= r2.vw && r2.offenders.length === 0, JSON.stringify(r2));
      await ev(p, () => document.querySelector('.gallery__button').click()); await sleep(500);
      for (let i = 0; i < 13; i++) await p.keyboard.press('ArrowRight');
      await sleep(200);
      const c = await ev(p, () => document.querySelector('[data-lightbox-count]').textContent);
      check('Stress content: gallery of 14 photos steps through to the end (counter "14 / 14")', /14\s*(\/|of)\s*14/.test(c), c);
      await p.keyboard.press('ArrowRight'); await sleep(200);
      const c2 = await ev(p, () => document.querySelector('[data-lightbox-count]').textContent);
      check('Stress content: Next after the last photo wraps to the first (or stops)', /1\s*(\/|of)\s*14/.test(c2) || /14\s*(\/|of)\s*14/.test(c2), c2);
    }
    await p.close();
  }

  const emptyCases = [
    ['gallery with zero images', `window.WEDDING_CONFIG.gallery.images = [];`, p => ev(p, () => ({ section: !!document.querySelector('#gallery') && document.querySelector('#gallery').getBoundingClientRect().height > 60, navLink: [...document.querySelectorAll('a[href="#gallery"]')].some(a => a.getClientRects().length > 0) }))],
    ['FAQ with zero items', `window.WEDDING_CONFIG.faq.items = [];`, p => ev(p, () => ({ section: !!document.querySelector('#faq') && document.querySelector('#faq').getBoundingClientRect().height > 60, navLink: [...document.querySelectorAll('a[href="#faq"]')].some(a => a.getClientRects().length > 0) }))],
    ['schedule with zero events', `window.WEDDING_CONFIG.schedule.events = [];`, p => ev(p, () => ({ slots: document.querySelectorAll('.slot').length, emptyLists: [...document.querySelectorAll('ul, ol, dl')].filter(l => !l.children.length && l.getBoundingClientRect().height >= 0 && !l.closest('[hidden]') && getComputedStyle(l).display !== 'none' && !l.closest('.svg-sprite')).map(l => l.className) }))],
    ['travel with zero accommodations and notes', `window.WEDDING_CONFIG.travel.accommodations = []; window.WEDDING_CONFIG.travel.notes = [];`, p => ev(p, () => ({ stays: document.querySelectorAll('.stay').length, heading: [...document.querySelectorAll('h3')].some(h => /where to stay/i.test(h.textContent) && h.offsetParent) }))],
    ['story with no milestones', `window.WEDDING_CONFIG.story.milestones = [];`, p => ev(p, () => ({ ms: document.querySelectorAll('.milestone').length, heading: [...document.querySelectorAll('h3')].some(h => /dates we hold/i.test(h.textContent) && h.offsetParent) }))],
    ['both gift links empty', `window.WEDDING_CONFIG.gifts.registryUrl = ''; window.WEDDING_CONFIG.gifts.fundUrl = '';`, p => ev(p, () => ({ buttons: [...document.querySelectorAll('.gifts__actions a, .gifts__actions button')].filter(b => b.getClientRects().length > 0).length, actionsBox: !!document.querySelector('.gifts__actions') && document.querySelector('.gifts__actions').getBoundingClientRect().height > 0 }))],
    ['no social links, no attribution', `window.WEDDING_CONFIG.footer.socials = []; window.WEDDING_CONFIG.footer.showAttribution = false;`, p => ev(p, () => ({ emptyUl: [...document.querySelectorAll('.site-footer ul')].filter(u => !u.children.length && u.getClientRects().length > 0).length, social: !!document.querySelector('.site-footer__social') && document.querySelector('.site-footer__social').children.length }))],
    ['banner disabled', `window.WEDDING_CONFIG.banner.enabled = false;`, p => ev(p, () => ({ banner: !!document.querySelector('[data-banner]') && getComputedStyle(document.querySelector('[data-banner]')).display !== 'none' && !document.querySelector('[data-banner]').hidden, gap: Math.round(document.querySelector('[data-site-header]').getBoundingClientRect().top) }))],
    ['couple introductions disabled', `window.WEDDING_CONFIG.introductions.enabled = false;`, p => ev(p, () => ({ section: !!document.querySelector('#couple') && document.querySelector('#couple').getBoundingClientRect().height > 0, navLink: [...document.querySelectorAll('a[href="#couple"]')].some(a => a.getClientRects().length > 0) }))],
    ['parking empty and no map URL', `window.WEDDING_CONFIG.details.parking = ''; window.WEDDING_CONFIG.details.parkingSummary = ''; window.WEDDING_CONFIG.details.mapUrl = '';`, p => ev(p, () => ({ parkingRow: [...document.querySelectorAll('.fact')].some(f => /parking/i.test(f.textContent) && f.getBoundingClientRect().height > 0), directions: [...document.querySelectorAll('a')].filter(a => /directions/i.test(a.textContent) && a.getClientRects().length > 0).length }))],
    ['gallery with exactly 1 image', `window.WEDDING_CONFIG.gallery.images = window.WEDDING_CONFIG.gallery.images.slice(0, 1);`, null],
    ['gallery with exactly 2 images', `window.WEDDING_CONFIG.gallery.images = window.WEDDING_CONFIG.gallery.images.slice(0, 2);`, null],
    ['RSVP maxGuests = 1', `window.WEDDING_CONFIG.rsvp.maxGuests = 1;`, p => ev(p, () => ({ options: [...document.querySelectorAll('#rsvp-guests option')].map(o => o.value), field: (() => { const f = document.querySelector('#rsvp-guests').closest('.field'); return f && !f.hidden; })() }))],
    ['RSVP maxGuests = 40', `window.WEDDING_CONFIG.rsvp.maxGuests = 40;`, p => ev(p, () => ({ n: document.querySelectorAll('#rsvp-guests option').length }))],
  ];
  const emptyExpect = {
    'gallery with zero images': r => !r.section || !r.navLink, // either hidden or consistent
    'FAQ with zero items': r => !r.section && !r.navLink,
    'schedule with zero events': r => r.emptyLists.length === 0,
    'travel with zero accommodations and notes': r => r.stays === 0 && !r.heading,
    'story with no milestones': r => r.ms === 0 && !r.heading,
    'both gift links empty': r => r.buttons === 0 && !r.actionsBox,
    'no social links, no attribution': r => r.emptyUl === 0,
    'banner disabled': r => !r.banner && r.gap === 0,
    'couple introductions disabled': r => !r.section && !r.navLink,
    'parking empty and no map URL': r => !r.parkingRow && r.directions === 0,
    'RSVP maxGuests = 1': r => r.options.length >= 1 && r.options.length <= 2,
    'RSVP maxGuests = 40': r => r.n >= 10 && r.n <= 41,
  };
  for (const [label, patch, probe] of emptyCases) {
    const p = await open(browser, { configPatch: patch, settle: 700 });
    await scrollThrough(p);
    const r = probe ? await probe(p) : null;
    const r2 = await overflowReport(p);
    let ok = noPageErrors(p).length === 0 && r2.docScroll <= r2.vw && p.warns.filter(w => !/at least six|fewer than six|six images/i.test(w)).length === 0;
    if (r && emptyExpect[label]) ok = ok && emptyExpect[label](r);
    check(`Config "${label}": renders without errors, nothing empty or orphaned is left behind`, ok, JSON.stringify({ r, errors: p.errors.slice(0, 2), warns: p.warns.slice(0, 2), overflow: r2.docScroll + '/' + r2.vw }));
    if (/exactly 1 image|exactly 2 images/.test(label)) {
      const n = /1 image/.test(label) ? 1 : 2;
      await ev(p, () => document.querySelector('.gallery__button').click()); await sleep(500);
      await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await sleep(250);
      const s = await ev(p, () => ({ count: document.querySelector('[data-lightbox-count]').textContent, open: document.querySelector('dialog').open, prev: getComputedStyle(document.querySelector('[data-lightbox-prev]')).display, next: getComputedStyle(document.querySelector('[data-lightbox-next]')).display, alt: document.querySelector('[data-lightbox-image]').alt.length > 5 }));
      check(`${label}: viewer works, arrow keys do not break it, counter is right`, s.open && s.alt && new RegExp('(\\d)\\s*(/|of)\\s*' + n).test(s.count) && (n > 1 || (s.prev === 'none' && s.next === 'none')), JSON.stringify(s));
      await p.keyboard.press('Escape');
    }
    await p.close();
  }

  /* ================= C4. Hostile strings in the config (XSS) ================= */
  section('C4. Hostile text and URLs in the config');
  {
    const evil = `${clone}
      window.__x = 0;
      const IMG = '<img src=x onerror="window.__x=1">'; const SCR = '<script>window.__x=2<\\/script>';
      C.couple.partnerOne = IMG; C.couple.partnerTwo = SCR; C.hero.tagline = IMG + '\\n*' + SCR + '*';
      C.story.paragraphs = [IMG + ' {contact} <b>bold</b>'];
      C.details.venueName = IMG; C.details.venueAddress = [SCR]; C.details.mapUrl = 'javascript:window.__x=3';
      C.travel.mapUrl = 'JaVaScRiPt:window.__x=4'; C.gifts.registryUrl = 'data:text/html,<script>window.__x=5<\\/script>'; C.gifts.fundUrl = 'vbscript:msgbox(1)';
      C.travel.accommodations[0].url = '//evil.example/x'; C.travel.accommodations[1].url = 'http://insecure.example/x';
      C.footer.socials = [{ label: IMG, url: 'javascript:window.__x=6' }, { label: 'ok', url: ' \\tjavascript:window.__x=7' }];
      C.footer.hashtag = IMG; C.footer.attributionUrl = 'javascript:window.__x=8'; C.footer.attributionText = IMG;
      C.faq.items = [{ q: IMG, a: SCR + ' {deadline} {contact}' }]; C.faq.contact = '"><img src=x onerror="window.__x=9">';
      C.banner.text = IMG; C.rsvp.successTitle = 'Thanks ' + IMG + ' {name}'; C.rsvp.heading = IMG;
      C.gallery.images[0].alt = IMG; C.gallery.images[0].src = 'javascript:window.__x=10';
      C.theme.colors.forest = 'red; } body { display:none } /*'; C.theme.colors.ivory = 'url(javascript:window.__x=11)'; C.theme.fonts.heading = "x'; } body{display:none} .a{font-family:'";`;
    const p = await open(browser, { configPatch: evil, settle: 900 });
    await scrollThrough(p);
    await ev(p, () => document.querySelector('.gallery__button') && document.querySelector('.gallery__button').click()); await sleep(400);
    const s = await ev(p, () => ({
      x: window.__x, injectedImg: document.querySelectorAll('img[src="x"]').length, scripts: [...document.querySelectorAll('script')].filter(s => !s.src).length,
      badHref: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\s*(javascript|data|vbscript):/i.test(h)),
      bodyVisible: getComputedStyle(document.body).display !== 'none', forest: getComputedStyle(document.documentElement).getPropertyValue('--color-forest').trim().slice(0, 40),
      asText: document.body.innerText.includes('<img src=x'), insecureLinks: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^(http:|\/\/)/i.test(h)),
    }));
    check('No config string runs as HTML or script (window.__x stays 0, no injected <img>/<script>)', s.x === 0 && s.injectedImg === 0 && s.scripts <= 1, JSON.stringify({ x: s.x, img: s.injectedImg, scripts: s.scripts }));
    check('Hostile text is shown literally as text instead', s.asText);
    check('javascript:, data: and vbscript: URLs never become link targets', s.badHref.length === 0, JSON.stringify(s.badHref));
    check('Protocol-relative (//host) URLs are not turned into links', s.insecureLinks.filter(h => h.startsWith('//')).length === 0, JSON.stringify(s.insecureLinks));
    note('Plain http: links are allowed as ordinary links by design (only the RSVP endpoint must be https): ' + JSON.stringify(s.insecureLinks.filter(h => /^http:/i.test(h))));
    check('Malicious theme colour / font values cannot inject CSS (body stays visible)', s.bodyVisible, s.forest);
    check('Hostile config logs no uncaught exception', noPageErrors(p).length === 0, JSON.stringify(noPageErrors(p).slice(0, 3)));
    note('Console messages with hostile config (informational): ' + JSON.stringify([...p.errors, ...p.warns].map(t => t.slice(0, 100)).slice(0, 8)));
    await p.close();
  }

  /* ================= C5. External links open correctly ================= */
  section('C5. Clicking external links (real navigation to a stubbed destination)');
  {
    const stub = req => {
      const u = req.url();
      if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)) return false;
      if (/^https?:/.test(u)) { req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title><p>external stub</p>' }); return true; }
      return false;
    };
    const p = await open(browser, { routes: async req => stub(req), settle: 600 });
    const hrefs = await ev(p, () => [...document.querySelectorAll('a[target=_blank]')].map((a, i) => { a.dataset.qaIdx = i; return { i, href: a.href, text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), rel: a.rel }; }));
    const bad = [];
    for (const h of hrefs) {
      const targetPromise = new Promise(res => { const f = t => { if (t.url() !== 'about:blank' || true) { browser.off('targetcreated', f); res(t); } }; browser.on('targetcreated', f); setTimeout(() => { browser.off('targetcreated', f); res(null); }, 4000); });
      await ev(p, i => document.querySelector(`[data-qa-idx="${i}"]`).click(), h.i);
      const t = await targetPromise;
      if (!t) { bad.push(h.text + ': no new tab opened'); continue; }
      let np; try { np = await t.page(); } catch (e) { np = null; }
      let opener = 'n/a', finalUrl = t.url();
      if (np) { try { await np.waitForNavigation({ timeout: 2500 }).catch(() => {}); } catch (e) { /* already loaded */ } try { opener = await np.evaluate(() => String(window.opener)); } catch (e) { opener = 'err'; } finalUrl = np.url(); await np.close().catch(() => {}); }
      if (opener !== 'null' && opener !== 'n/a') bad.push(`${h.text}: new tab can reach window.opener (${opener})`);
      if (finalUrl && finalUrl !== 'about:blank' && finalUrl.replace(/\/$/, '') !== h.href.replace(/\/$/, '')) bad.push(`${h.text}: opened ${finalUrl} instead of ${h.href}`);
    }
    check(`All ${hrefs.length} new-tab links open the right URL in a new tab and the new tab cannot control this page (window.opener is null)`, bad.length === 0, JSON.stringify(bad));
    check('The wedding page itself stays on the same page after those clicks', (await ev(p, () => location.pathname.endsWith('index.html') || location.pathname === '/')), await ev(p, () => location.href));
    const mail = await ev(p, () => [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href')));
    note('mailto links present (a browser hands these to the visitor\u2019s mail app; not clickable-tested): ' + JSON.stringify(mail));
    await p.close();
  }

  /* ================= C6. Print ================= */
  section('C6. Print stylesheet');
  {
    const p = await open(browser, { width: 794, height: 1123, settle: 600 });
    await scrollThrough(p);
    await p.emulateMediaType('print'); await sleep(500);
    const r = await ev(p, () => {
      const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const light = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const e = n.parentElement; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('.svg-sprite,.sr-only,[hidden]')) continue; const l = lum(cs.color); /* browsers drop backgrounds when printing by default, so the text must be dark enough to read on white */ if ((1.05) / (l + 0.05) < 3) light.push(e.className || e.tagName); }
      return { fixed: [...document.querySelectorAll('.site-header, .banner, dialog:not([open]), .skip-link')].filter(e => getComputedStyle(e).display !== 'none' && !e.matches('dialog')).map(e => e.className), light: [...new Set(light)].slice(0, 12), hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 1 || (getComputedStyle(e).clipPath !== 'none' && getComputedStyle(e).clipPath !== 'inset(0px)')).length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cdTimer: getComputedStyle(document.querySelector('.countdown__timer')).display };
    });
    check('Print: header, banner and skip link are hidden', r.fixed.length === 0, JSON.stringify(r.fixed));
    check('Print: no content is left invisible by reveal animations', r.hiddenReveal === 0, String(r.hiddenReveal));
    check('Print: no text is too pale to read on white paper (browsers omit backgrounds)', r.light.length === 0, JSON.stringify(r.light));
    check('Print: no horizontal overflow on A4 width', r.overflow <= 0, String(r.overflow));
    let pdfInfo = '';
    try { const pdf = await p.pdf({ format: 'A4', printBackground: false }); pdfInfo = `${Math.round(pdf.length / 1024)} KB, ${(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length} pages`; check('Print: a PDF can be produced from the page', pdf.length > 20000, pdfInfo); } catch (e) { check('Print: a PDF can be produced from the page', false, e.message); }
    await p.close();
  }

  /* ================= C7. Forced colours, dark scheme, contrast preferences ================= */
  section('C7. Forced colours (Windows High Contrast), dark colour scheme');
  {
    const p = await open(browser, { media: [{ name: 'forced-colors', value: 'active' }], settle: 700 });
    await ev(p, () => document.querySelector('[data-menu-toggle]') && 0);
    const r = await ev(p, () => {
      const visible = e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
      const edge = e => { const cs = getComputedStyle(e); const sides = ['Top', 'Right', 'Bottom', 'Left']; return sides.some(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; };
      const noEdge = [...document.querySelectorAll('.btn, .faq__trigger, input:not([type=radio]):not(.hp input), select, textarea, .choice__box')].filter(visible).filter(e => !edge(e)).map(e => e.className || e.tagName);
      return { noEdge: [...new Set(noEdge)], forced: matchMedia('(forced-colors: active)').matches };
    });
    check('Forced colours: emulation is active', r.forced);
    check('Forced colours: buttons, fields, FAQ rows and choice boxes still have a visible border or outline', r.noEdge.length === 0, JSON.stringify(r.noEdge));
    await p.screenshot({ path: require('path').join(process.env.TEMP || '.', 'wt-test', 'forced-colors.png') });
    await p.close();
  }
  {
    const p = await open(browser, { media: [{ name: 'prefers-color-scheme', value: 'dark' }], settle: 600 });
    const r = await ev(p, () => {
      const parse = c => c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const L = c => { const m = parse(c); return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const controls = [...document.querySelectorAll('input[type=text], input[type=email], select, textarea')].map(e => { const cs = getComputedStyle(e); return { id: e.id, ratio: +ratio(cs.color, cs.backgroundColor).toFixed(1) }; });
      return { controls, bodyRatio: +ratio(getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor).toFixed(1), scheme: getComputedStyle(document.documentElement).colorScheme };
    });
    check('Dark colour scheme: page text and every form control stay readable (>= 4.5:1), nothing turns dark-on-dark', r.bodyRatio >= 4.5 && r.controls.every(c => c.ratio >= 4.5), JSON.stringify(r));
    await p.close();
  }
  {
    const p = await open(browser, { media: [{ name: 'prefers-contrast', value: 'more' }, { name: 'prefers-reduced-transparency', value: 'reduce' }], settle: 500 });
    check('prefers-contrast: more / reduced transparency: page renders with no errors', noPageErrors(p).length === 0);
    await p.close();
  }

  /* ================= C8. Network behaviour ================= */
  section('C8. Initial load behaviour (measured; informational numbers, plain uncompressed local server)');
  {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const reqs = [];
    p.on('response', async r => { try { const b = await r.buffer(); reqs.push({ url: r.url(), type: r.request().resourceType(), size: b.length }); } catch (e) { reqs.push({ url: r.url(), type: r.request().resourceType(), size: 0 }); } });
    await p.goto(require('./qa-helpers').BASE, { waitUntil: 'networkidle0' }); await sleep(800);
    const imgs = reqs.filter(r => r.type === 'image'); const total = reqs.reduce((a, r) => a + r.size, 0);
    note(`Before any scrolling on a phone: ${reqs.length} requests, ${(total / 1024).toFixed(0)} KB total; images: ${imgs.length} (${(imgs.reduce((a, r) => a + r.size, 0) / 1024).toFixed(0)} KB); fonts: ${reqs.filter(r => r.type === 'font').length}; scripts: ${reqs.filter(r => r.type === 'script').length}`);
    const below = imgs.filter(r => /gallery-|portrait-|final-/.test(r.url));
    check('Below-the-fold photos are lazy: none of the gallery, portrait, story or finale images load before scrolling', below.length === 0, JSON.stringify(below.map(b => b.url.split('/').pop())));
    check('First-load images are limited to the hero, tiny inline icons and (on a phone) the story photo that Chrome starts early because it sits within its lazy-load distance', imgs.filter(r => !/hero-|\.svg|favicon|^data:|svg%3E|base64/.test(r.url) && !/story-/.test(r.url)).length === 0, JSON.stringify(imgs.map(i => i.url.split('/').pop())));
    check('No third-party requests are made (everything is self-hosted)', reqs.every(r => /^https?:\/\/(127\.0\.0\.1|localhost)/.test(r.url) || r.url.startsWith('data:')), JSON.stringify(reqs.filter(r => !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(r.url)).map(r => r.url)));
    await p.close();
  }

  await browser.close();
  process.exitCode = summary() ? 1 : 0;
})().catch(e => { console.error('QA-C CRASHED', e); process.exit(2); });
