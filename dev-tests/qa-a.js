/* QA part A: assets, links, semantics, axe accessibility scans, text-over-photo contrast,
   breakpoint sweep, enlarged text, text spacing and live resizing. */
const H = require('./qa-helpers');
const { fs, path, ROOT, BASE, sleep, check, note, section, launch, open, scrollThrough, overflowReport, smallTargets } = H;

const AXE_SOURCE = fs.readFileSync(path.join(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter)[0] : path.join(ROOT, 'dev-tests', 'node_modules'), 'axe-core', 'axe.min.js'), 'utf8');

async function runAxe(page) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(() => axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    resultTypes: ['violations', 'incomplete']
  }).then(r => ({
    violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => ({ target: n.target.join(' '), why: (n.failureSummary || '').split('\n').slice(0, 3).join(' | ') })), count: v.nodes.length })),
    incomplete: r.incomplete.map(v => ({ id: v.id, count: v.nodes.length })),
    passes: r.passes.length
  })));
}

async function axeCheck(page, label) {
  const r = await runAxe(page);
  check(`axe (${label}): no violations`, r.violations.length === 0, r.violations.length ? JSON.stringify(r.violations) : `${r.passes} rules passed` + (r.incomplete.length ? `; needs manual review: ${r.incomplete.map(i => i.id + '×' + i.count).join(', ')}` : ''));
  return r;
}

const parseColor = `
  const parse = c => {
    let m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(c);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = /color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?/.exec(c);
    if (m) return { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
`;

/* Contrast of text that sits on a photograph, using the real rendered pixels behind each line of text.
   Worst case = the brightest 5% of the background pixels behind the text. */
async function photoTextContrast(page, containerSel, targets) {
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'start' }), containerSel);
  await sleep(1600);
  const prep = await page.evaluate((cSel, tSels) => {
    const header = document.querySelector('[data-site-header]'); if (header) header.style.visibility = 'hidden';
    const c = document.querySelector(cSel); const cr = c.getBoundingClientRect();
    return tSels.map(s => {
      const el = document.querySelector(s); const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1).map(r => ({ x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }));
      const cs = getComputedStyle(el); el.style.visibility = 'hidden';
      return { sel: s, rects, color: cs.color, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight || 400 };
    });
  }, containerSel, targets);
  await sleep(250);
  const b64 = await (await page.$(containerSel)).screenshot({ encoding: 'base64' });
  await page.evaluate(tSels => { tSels.forEach(s => { document.querySelector(s).style.visibility = ''; }); const h = document.querySelector('[data-site-header]'); if (h) h.style.visibility = ''; }, targets);
  const out = [];
  for (const t of prep) {
    const ratio = await page.evaluate(async (b64, t, parseColor) => {
      const { parse, lum } = new Function(parseColor + '; return { parse, lum };')();
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const L = [];
      t.rects.forEach(r => {
        const d = cx.getImageData(Math.max(0, Math.floor(r.x)), Math.max(0, Math.floor(r.y)), Math.max(1, Math.floor(r.w)), Math.max(1, Math.floor(r.h))).data;
        for (let i = 0; i < d.length; i += 28) L.push(lum(d[i], d[i + 1], d[i + 2]));
      });
      L.sort((a, b) => a - b);
      const bg = L[Math.floor(L.length * 0.95)];
      const c = parse(t.color); const tl = lum(c.r, c.g, c.b);
      const eff = c.a * tl + (1 - c.a) * bg; // approximate alpha blend
      return (Math.max(eff, bg) + 0.05) / (Math.min(eff, bg) + 0.05);
    }, b64, t, parseColor);
    const large = t.fs >= 24 || (t.fs >= 18.66 && t.fw >= 700);
    out.push({ sel: t.sel, ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, size: Math.round(t.fs) });
  }
  return out;
}

(async () => {
  const browser = await launch();

  /* ================= A1. Assets ================= */
  section('A1. Assets and requests');
  {
    const page = await open(browser, { width: 1440 });
    await scrollThrough(page);
    const count = await page.$$eval('.gallery__button', b => b.length);
    for (let i = 0; i < count; i++) {
      await page.evaluate(i => document.querySelectorAll('.gallery__button')[i].click(), i); await sleep(300);
      await page.keyboard.press('Escape'); await sleep(350);
    }
    check(`No failed or 4xx/5xx requests after a full scroll and opening all ${count} gallery photos`, page.bad.length === 0, JSON.stringify(page.bad));
    check('No console errors or unexpected warnings during that walk', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));

    const refs = await page.evaluate(() => {
      const set = new Set();
      const add = u => { try { if (u && !u.startsWith('data:')) set.add(new URL(u, document.baseURI).href); } catch (e) { /* ignore */ } };
      const srcset = s => (s || '').split(',').forEach(x => add(x.trim().split(/\s+/)[0]));
      document.querySelectorAll('img').forEach(i => { add(i.currentSrc); add(i.getAttribute('src')); srcset(i.getAttribute('srcset')); });
      document.querySelectorAll('link[href]').forEach(l => add(l.href));
      document.querySelectorAll('link[imagesrcset]').forEach(l => srcset(l.getAttribute('imagesrcset')));
      document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(m => add(m.content));
      const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.src === 'string') add(o.src); if (typeof o.srcset === 'string') srcset(o.srcset); Object.values(o).forEach(walk); };
      walk(window.WEDDING_CONFIG);
      return [...set];
    });
    const origin = new URL(BASE).origin;
    const local = refs.filter(u => u.startsWith(origin));
    const external = refs.filter(u => !u.startsWith(origin));
    const bad = [];
    for (const u of local) {
      try { const r = await fetch(u); const buf = await r.arrayBuffer(); if (!r.ok || buf.byteLength < 100) bad.push(u + ' status ' + r.status + ' bytes ' + buf.byteLength); }
      catch (e) { bad.push(u + ' ' + e.message); }
    }
    check(`Every referenced local file exists and is non-empty (${local.length} files checked)`, bad.length === 0, JSON.stringify(bad));
    const placeholderExternal = external.filter(u => /your-domain\.com|example\.com/.test(u));
    const missingLocalForExternal = placeholderExternal.filter(u => /\/assets\//.test(u) && !fs.existsSync(path.join(ROOT, new URL(u).pathname)));
    check('Social-share / canonical placeholder URLs point at files that exist locally once the domain is replaced', missingLocalForExternal.length === 0, JSON.stringify(missingLocalForExternal));
    note(`External references (placeholders the owner must replace): ${JSON.stringify(external)}`);

    // Declared sizes vs real file sizes
    const dims = await page.evaluate(async () => {
      const problems = [];
      const objs = [];
      const walk = (o, p) => { if (!o || typeof o !== 'object') return; if (typeof o.src === 'string' && o.width && o.height) objs.push({ p, o }); Object.keys(o).forEach(k => walk(o[k], p + '.' + k)); };
      walk(window.WEDDING_CONFIG, 'config');
      const load = u => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = u; });
      for (const { p, o } of objs) {
        const cands = [{ u: o.src, w: null }];
        (o.srcset || '').split(',').forEach(s => { const [u, d] = s.trim().split(/\s+/); if (u) cands.push({ u, w: d && /w$/.test(d) ? parseInt(d, 10) : null }); });
        for (const c of cands) {
          const n = await load(c.u);
          if (!n) { problems.push(p + ' failed ' + c.u); continue; }
          if (Math.abs(n.w / n.h - o.width / o.height) > 0.012) problems.push(`${p}: ${c.u} is ${n.w}x${n.h} but config says ${o.width}x${o.height} (would distort or shift layout)`);
          if (c.w && n.w !== c.w) problems.push(`${p}: srcset says ${c.w}w but ${c.u} is ${n.w}px wide`);
        }
      }
      return { checked: objs.length, problems };
    });
    check(`Image files match their declared width/height ratio and srcset widths (${dims.checked} configured images)`, dims.problems.length === 0, JSON.stringify(dims.problems));

    // Orphans
    const text = ['index.html', 'js/config.js', 'css/styles.css', 'js/main.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const orphans = [];
    for (const dir of ['images', 'fonts', 'icons']) {
      for (const f of fs.readdirSync(path.join(ROOT, 'assets', dir))) { if (!text.includes(f) && f !== 'OFL.txt') orphans.push(dir + '/' + f); }
    }
    check('No unreferenced (orphan) files in assets/', orphans.length === 0, JSON.stringify(orphans));
    let total = 0; fs.readdirSync(path.join(ROOT, 'assets', 'images')).forEach(f => { total += fs.statSync(path.join(ROOT, 'assets', 'images', f)).size; });
    note(`Total image weight on disk: ${(total / 1048576).toFixed(2)} MB`);
    await page.close();
  }

  /* ================= A2. Links ================= */
  section('A2. Links');
  {
    const page = await open(browser, { width: 1280 });
    await scrollThrough(page);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({
      href: a.getAttribute('href'), abs: a.href, blank: a.target === '_blank', rel: a.rel,
      name: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim()
    })));
    const problems = [];
    const ids = await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map(e => e.id)).size && [...document.querySelectorAll('[id]')].map(e => e.id));
    links.forEach(l => {
      if (!l.href || l.href === '#') problems.push('empty href: ' + l.name);
      else if (l.href.startsWith('#') && !ids.includes(l.href.slice(1))) problems.push('dead anchor ' + l.href);
      else if (/^javascript:/i.test(l.href)) problems.push('javascript: link ' + l.name);
      else if (/^http:\/\//i.test(l.abs) && !l.abs.startsWith('http://127.0.0.1')) problems.push('insecure http link ' + l.abs);
      if (!l.name) problems.push('link with no accessible name: ' + l.href);
    });
    check(`All ${links.length} links are well formed (no empty/dead/javascript:/insecure/unnamed)`, problems.length === 0, JSON.stringify(problems));

    const blanks = links.filter(l => l.blank);
    check(`All ${blanks.length} new-tab links use rel="noopener noreferrer"`, blanks.every(l => /noopener/.test(l.rel) && /noreferrer/.test(l.rel)), JSON.stringify(blanks.filter(l => !/noopener/.test(l.rel)).map(l => l.name)));
    check('All new-tab links warn screen-reader users ("opens in a new tab") or are announced as such', blanks.every(l => /new tab|new window/i.test(l.name)), JSON.stringify(blanks.filter(l => !/new tab|new window/i.test(l.name)).map(l => l.name)));

    const byName = {};
    links.forEach(l => { (byName[l.name] = byName[l.name] || new Set()).add(l.abs); });
    const ambiguous = Object.entries(byName).filter(([n, s]) => s.size > 1).map(([n, s]) => n + ' -> ' + s.size + ' destinations');
    note('Link texts shared by several destinations (check that surrounding context makes them clear): ' + JSON.stringify(ambiguous));
    const mail = links.filter(l => /^mailto:/i.test(l.href));
    check('mailto links are valid addresses', mail.every(l => /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.href)), JSON.stringify(mail.map(l => l.href)));
    const placeholders = links.filter(l => /example\.com|your-domain|instagram\.com\/your|#REPLACE/i.test(l.abs));
    note(`${placeholders.length} link(s) still point at sample/placeholder URLs (expected in the template; listed in the README checklist): ${JSON.stringify([...new Set(placeholders.map(l => l.abs))])}`);

    // Skip link
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
    await page.keyboard.press('Tab'); await sleep(450); // the link slides in with a short transition
    const skip = await page.evaluate(() => { const e = document.activeElement; const b = e.getBoundingClientRect(); return { cls: e.className, visible: b.width > 1 && b.height > 1 && b.top >= 0 && b.top < 200, text: e.textContent.trim() }; });
    check('First Tab stop is the skip link and it becomes visible', /skip-link/.test(skip.cls) && skip.visible, JSON.stringify(skip));
    await page.keyboard.press('Enter'); await sleep(500);
    await page.keyboard.press('Tab');
    const afterSkip = await page.evaluate(() => ({ inMain: !!document.activeElement.closest('main'), tag: document.activeElement.tagName + ' ' + (document.activeElement.textContent || '').trim().slice(0, 24) }));
    check('After using the skip link, the next Tab lands inside <main> (not back in the header)', afterSkip.inMain, JSON.stringify(afterSkip));

    // Each in-page link scrolls its target under the header
    const hashes = [...new Set(links.filter(l => l.href.startsWith('#') && l.href.length > 1 && l.href !== '#main').map(l => l.href))];
    const topLike = h => h === '#top';
    const misaligned = [];
    for (const h of hashes) {
      await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); history.replaceState(null, '', location.pathname); });
      await sleep(250);
      const clicked = await page.evaluate(h => { const a = [...document.querySelectorAll(`a[href="${h}"]`)].find(x => x.getBoundingClientRect().width > 0); if (!a) return false; a.click(); return true; }, h);
      if (!clicked) { misaligned.push(h + ' (no visible link to click)'); continue; }
      await sleep(1300);
      const r = await page.evaluate(h => { const t = document.querySelector(h); if (h === '#top') return { hash: location.hash, top: 0, navBottom: 0, vh: innerHeight, atBottom: false, scrollY: Math.round(scrollY) };  const b = t.getBoundingClientRect(); const nav = document.querySelector('[data-site-header]').getBoundingClientRect(); return { hash: location.hash, top: Math.round(b.top), navBottom: Math.round(nav.bottom), vh: innerHeight, atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }; }, h);
      if (r.hash !== h) misaligned.push(h + ' URL hash is ' + r.hash);
      else if (topLike(h)) { if (r.scrollY > 4) misaligned.push('#top leaves the page scrolled to ' + r.scrollY + 'px'); }
      else if (!r.atBottom && (r.top < r.navBottom - 4 || r.top > r.vh * 0.5)) misaligned.push(`${h} lands at top=${r.top}px (header bottom ${r.navBottom})`);
    }
    check(`Each of the ${hashes.length} in-page links scrolls its section into view beneath the sticky header and updates the URL`, misaligned.length === 0, JSON.stringify(misaligned));

    // Back to top + brand link
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await sleep(300);
    await page.evaluate(() => document.querySelector('.site-footer__top').click()); await sleep(1500);
    check('"Back to top" returns to the top of the page', (await page.evaluate(() => scrollY)) < 5);
    await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' })); await sleep(300);
    await page.evaluate(() => document.querySelector('.brand').click()); await sleep(1500);
    check('Brand/logo link returns to the top of the page', (await page.evaluate(() => scrollY)) < 5);
    check('No console errors/warnings while clicking links', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();

    // Mobile menu: each link closes the menu and lands correctly
    const m = await open(browser, { width: 390, height: 844, mobile: true });
    const mobileProblems = [];
    const navHashes = await m.evaluate(() => [...document.querySelectorAll('#site-menu a[href^="#"]')].map(a => a.getAttribute('href')));
    for (const h of navHashes) {
      await m.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); });
      await sleep(250);
      await m.click('[data-menu-toggle]'); await sleep(350);
      const opened = await m.evaluate(() => document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'));
      await m.evaluate(h => document.querySelector(`#site-menu a[href="${h}"]`).click(), h);
      await sleep(1300);
      const r = await m.evaluate(h => ({ expanded: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'), top: Math.round(document.querySelector(h).getBoundingClientRect().top), nav: Math.round(document.querySelector('[data-site-header]').getBoundingClientRect().bottom), atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }), h);
      if (opened !== 'true') mobileProblems.push(h + ' menu did not open');
      if (r.expanded !== 'false') mobileProblems.push(h + ' menu stayed open');
      if (!r.atBottom && (r.top < r.nav - 4 || r.top > 500)) mobileProblems.push(`${h} top=${r.top} nav=${r.nav}`);
    }
    check(`Mobile menu: all ${navHashes.length} links open the menu, close it and scroll to a correct position`, mobileProblems.length === 0, JSON.stringify(mobileProblems));
    await m.close();
  }

  /* ================= A3. Deep links on load ================= */
  section('A3. Deep links on load');
  for (const hash of ['#faq', '#gallery', '#rsvp', '#details', '#celebrate']) {
    const page = await open(browser, { width: 1280, hash, settle: 1400 });
    const r = await page.evaluate(h => { const t = document.querySelector(h); if (h === '#top') return { hash: location.hash, top: 0, navBottom: 0, vh: innerHeight, atBottom: false, scrollY: Math.round(scrollY) };  const b = t.getBoundingClientRect(); return { top: Math.round(b.top), nav: Math.round(document.querySelector('[data-site-header]').getBoundingClientRect().bottom), vh: innerHeight, atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 }; }, hash);
    check(`Loading index.html${hash} scrolls to the section (below the header, not hidden)`, (r.top >= r.nav - 4 && r.top < r.vh * 0.5) || r.atBottom, JSON.stringify(r));
    check(`Loading index.html${hash} causes no console errors`, page.errors.length === 0, JSON.stringify(page.errors));
    await page.close();
  }
  for (const hash of ['#does-not-exist', '#%E0%A4%A', '#%', '#faq%20x', '#<script>']) {
    const page = await open(browser, { width: 1280, hash, settle: 800 });
    check(`Odd hash "${hash}" does not break the page or log errors`, page.errors.length === 0 && (await page.evaluate(() => document.documentElement.classList.contains('js-ready') && document.querySelectorAll('.gallery__item').length === 7)), JSON.stringify(page.errors));
    await page.close();
  }

  /* ================= A4. Page semantics ================= */
  section('A4. Page semantics and meta');
  {
    const page = await open(browser, { width: 1280 });
    await scrollThrough(page);
    const s = await page.evaluate(() => {
      const out = {};
      const idList = [...document.querySelectorAll('[id]')].map(e => e.id);
      out.dupIds = idList.filter((id, i) => idList.indexOf(id) !== i);
      out.badRefs = [];
      ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns'].forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(e => e.getAttribute(attr).split(/\s+/).forEach(id => { if (id && !document.getElementById(id)) out.badRefs.push(`${attr}=${id}`); }));
      });
      document.querySelectorAll('label[for]').forEach(l => { if (!document.getElementById(l.htmlFor)) out.badRefs.push('label for=' + l.htmlFor); });
      out.landmarks = { main: document.querySelectorAll('main, [role=main]').length, banner: document.querySelectorAll('body > header, [role=banner]').length, contentinfo: document.querySelectorAll('body > footer, [role=contentinfo]').length, nav: [...document.querySelectorAll('nav')].map(n => n.getAttribute('aria-label') || null) };
      out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.offsetParent !== null || getComputedStyle(h).position === 'fixed').map(h => h.tagName + ':' + h.textContent.replace(/\s+/g, ' ').trim().slice(0, 28));
      out.emptyHeadings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => !h.textContent.trim() && !h.hidden && !h.closest('[hidden]') && getComputedStyle(h).display !== 'none').length;
      out.h1Count = document.querySelectorAll('h1').length; out.hiddenEmptyHeadings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => !h.textContent.trim() && (h.hidden || h.closest('[hidden]'))).map(h => h.className || h.tagName);
      out.lang = document.documentElement.lang; out.title = document.title;
      const vp = document.querySelector('meta[name=viewport]'); out.viewport = vp && vp.content;
      out.metaDesc = (document.querySelector('meta[name=description]') || {}).content || '';
      out.og = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].filter(p => !document.querySelector(`meta[property="${p}"]`));
      out.twitter = !!document.querySelector('meta[name="twitter:card"]');
      out.canonical = !!document.querySelector('link[rel=canonical]');
      out.favicon = !!document.querySelector('link[rel~=icon]');
      out.posTabindex = [...document.querySelectorAll('[tabindex]')].filter(e => +e.getAttribute('tabindex') > 0).length;
      out.inlineHandlers = [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length;
      out.buttonsNoType = [...document.querySelectorAll('button')].filter(b => !b.hasAttribute('type')).length;
      out.imgNoAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
      out.contentImgEmptyAlt = [...document.querySelectorAll('.gallery img, .hero img, .person img, .story img')].filter(i => !i.getAttribute('alt')).length;
      out.noscript = !!document.querySelector('noscript');
      out.inputs = [...document.querySelectorAll('input:not([type=radio]):not(.hp input), select, textarea')].map(i => ({ id: i.id, ac: i.getAttribute('autocomplete'), type: i.type }));
      return out;
    });
    check('No duplicate id attributes', s.dupIds.length === 0, JSON.stringify(s.dupIds));
    check('All aria-controls / labelledby / describedby / label-for references resolve', s.badRefs.length === 0, JSON.stringify(s.badRefs));
    check('Landmarks: one main, one banner, one contentinfo, every nav labelled', s.landmarks.main === 1 && s.landmarks.banner === 1 && s.landmarks.contentinfo === 1 && s.landmarks.nav.every(Boolean), JSON.stringify(s.landmarks));
    check('No empty headings, and exactly one h1', s.emptyHeadings === 0 && s.h1Count === 1, s.headings.length + ' visible headings; empty-but-hidden (filled in later by the RSVP form): ' + JSON.stringify(s.hiddenEmptyHeadings));
    note('Heading outline: ' + s.headings.join(' | '));
    check('<html lang> is set and <title> is present', !!s.lang && s.title.length > 5, `${s.lang} / "${s.title}" (${s.title.length} chars)`);
    check('Viewport meta does not block pinch-zoom (no user-scalable=no / maximum-scale<5)', s.viewport && !/user-scalable\s*=\s*(no|0)/i.test(s.viewport) && !/maximum-scale\s*=\s*[1-4](\.|,|$)/i.test(s.viewport), s.viewport);
    check('Meta description length is reasonable (50-170 chars)', s.metaDesc.length >= 50 && s.metaDesc.length <= 170, s.metaDesc.length + ' chars');
    check('Open Graph, Twitter card, canonical and favicon tags are present', s.og.length === 0 && s.twitter && s.canonical && s.favicon, JSON.stringify(s.og));
    check('No positive tabindex, no inline on* handlers, every <button> has a type', s.posTabindex === 0 && s.inlineHandlers === 0 && s.buttonsNoType === 0, JSON.stringify({ pos: s.posTabindex, inline: s.inlineHandlers, noType: s.buttonsNoType }));
    check('Every <img> has an alt attribute and every content photo has descriptive alt text', s.imgNoAlt === 0 && s.contentImgEmptyAlt === 0, JSON.stringify({ noAlt: s.imgNoAlt, emptyContentAlt: s.contentImgEmptyAlt }));
    check('A <noscript> fallback message exists', s.noscript);
    check('Text inputs declare autocomplete (name, email)', s.inputs.filter(i => i.id === 'rsvp-name' || i.id === 'rsvp-email').every(i => i.ac), JSON.stringify(s.inputs));
    await page.close();

    const mob = await open(browser, { width: 390, height: 844, mobile: true });
    const fs16 = await mob.evaluate(() => [...document.querySelectorAll('input, select, textarea')].filter(e => !e.closest('.hp') && e.type !== 'radio').map(e => ({ id: e.id, size: parseFloat(getComputedStyle(e).fontSize) })).filter(x => x.size < 16));
    check('Form fields use at least 16px text on phones (prevents iOS Safari zooming on focus)', fs16.length === 0, JSON.stringify(fs16));
    await mob.close();
  }

  /* ================= A5. axe scans ================= */
  section('A5. axe-core accessibility scans (WCAG 2.0/2.1/2.2 A+AA and best practices)');
  {
    let page = await open(browser, { width: 1440, height: 900 });
    await scrollThrough(page);
    await axeCheck(page, 'desktop 1440, initial');
    // FAQ all open
    await page.evaluate(() => document.querySelectorAll('.faq__trigger').forEach(t => t.click())); await sleep(700);
    await axeCheck(page, 'desktop, all FAQ answers open');
    // RSVP errors + accepts
    await page.evaluate(() => document.querySelector('[data-submit]').click()); await sleep(300);
    await axeCheck(page, 'desktop, RSVP validation errors showing');
    await page.evaluate(() => { document.querySelector('input[name=attendance][value=accepts]').click(); }); await sleep(300);
    await axeCheck(page, 'desktop, RSVP "accepts" fields visible');
    await page.type('#rsvp-name', 'Zoe Tester'); await page.type('#rsvp-email', 'zoe@example.com');
    await page.evaluate(() => document.querySelector('[data-submit]').click()); await sleep(1500);
    await axeCheck(page, 'desktop, RSVP success panel');
    // Lightbox
    await page.evaluate(() => document.querySelector('.gallery__button').click()); await sleep(700);
    await axeCheck(page, 'desktop, lightbox open');
    await page.close();

    page = await open(browser, { width: 390, height: 844, mobile: true });
    await scrollThrough(page);
    await axeCheck(page, 'mobile 390, initial');
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await page.click('[data-menu-toggle]'); await sleep(450);
    await axeCheck(page, 'mobile, menu open');
    await page.close();

    page = await open(browser, { width: 1280, configPatch: `window.WEDDING_CONFIG.wedding.dateTime='2020-05-02T14:30:00';` });
    await scrollThrough(page);
    await axeCheck(page, 'desktop, wedding date in the past (countdown replaced by message)');
    await page.close();

    page = await open(browser, { width: 1280, reducedMotion: true });
    await scrollThrough(page);
    await axeCheck(page, 'desktop, reduced motion');
    await page.close();
  }

  /* ================= A6. Text over photographs ================= */
  section('A6. Contrast of text that sits on photographs (measured from rendered pixels)');
  for (const w of [1440, 1100, 900, 390]) {
    const page = await open(browser, { width: w, height: w < 600 ? 844 : 900, mobile: w < 600 });
    await page.evaluate(() => document.querySelector('#celebrate').scrollIntoView()); await sleep(600);
    const rows = await photoTextContrast(page, '#celebrate', ['.finale__date', '.finale__title', '.finale__text span:first-child', '.finale__signature']);
    rows.forEach(r => check(`${w}px finale ${r.sel}: contrast ${r.ratio}:1 (needs ${r.need}:1 at ${r.size}px)`, r.ratio >= r.need));
    await page.close();
  }

  /* ================= A7. Breakpoint sweep ================= */
  section('A7. Breakpoint sweep (one page resized live, so resize handling is exercised too)');
  {
    const page = await open(browser, { width: 1440, height: 900 });
    const sizes = [[320, 568], [340, 640], [360, 740], [375, 667], [390, 844], [412, 915], [430, 932], [480, 800], [540, 900], [600, 900], [640, 900], [700, 900], [768, 1024], [820, 1180], [900, 900], [959, 900], [960, 900], [1024, 768], [1100, 900], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440],
      [667, 375], [844, 390], [932, 430], [1180, 820]];
    const failures = [];
    for (const [w, h] of sizes) {
      await page.setViewport({ width: w, height: h, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }); // never toggle isMobile: Puppeteer reloads the page when it changes, which would hide resize bugs
      await sleep(500);
      await scrollThrough(page);
      const r = await overflowReport(page);
      const small = await smallTargets(page);
      const ui = await page.evaluate(() => {
        const vis = e => e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
        const toggle = vis(document.querySelector('[data-menu-toggle]'));
        const links = vis(document.querySelector('.site-nav__list a'));
        const h1 = document.querySelector('.hero__title').getBoundingClientRect();
        const header = document.querySelector('[data-site-header]').getBoundingClientRect();
        window.scrollTo(80, 0);
        const sx = window.scrollX; window.scrollTo(0, 0);
        const fonts = [...document.querySelectorAll('p, a, li, dd, dt, span, button, label')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize));
        return { toggle, links, h1Right: Math.round(h1.right), vw: document.documentElement.clientWidth, headerH: Math.round(header.height), sx, minFont: Math.min(...fonts) };
      });
      const wantDesktop = w >= 960;
      const issues = [];
      if (r.docScroll > r.vw) issues.push(`document scrolls horizontally (${r.docScroll} > ${r.vw})`);
      if (r.offenders.length) issues.push('outside viewport: ' + r.offenders.slice(0, 3).join('; '));
      if (small.length) issues.push('tiny targets: ' + small.slice(0, 3).join(', '));
      if (wantDesktop ? (ui.toggle || !ui.links) : (!ui.toggle || ui.links)) issues.push(`navigation mode wrong (toggle ${ui.toggle}, links ${ui.links})`);
      if (ui.h1Right > ui.vw) issues.push('hero title wider than viewport');
      if (ui.sx !== 0) issues.push('page can be panned sideways');
      if (ui.headerH > h * 0.3) issues.push(`header uses ${ui.headerH}px of ${h}px height`);
      if (ui.minFont < 11) issues.push('smallest text is ' + ui.minFont + 'px');
      if (issues.length) failures.push(`${w}x${h}: ${issues.join(' | ')}`);
    }
    check(`All ${sizes.length} viewport sizes (320-2560 wide, incl. 959/960 and phone landscape): no overflow, correct nav mode, no tiny targets, text >= 11px`, failures.length === 0, JSON.stringify(failures));
    check('No console errors/warnings while resizing through every breakpoint', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();
  }

  /* ================= A8. Enlarged text and text spacing ================= */
  section('A8. User text settings (200% base font size, WCAG 1.4.12 text spacing)');
  for (const [w, h, mobile] of [[1280, 800, false], [390, 844, true]]) {
    for (const [label, css] of [
      ['browser font size 200%', 'html { font-size: 200% !important; }'],
      ['WCAG text-spacing overrides', '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }']
    ]) {
      const page = await open(browser, { width: w, height: h, mobile });
      await page.addStyleTag({ content: css }); await sleep(400);
      await scrollThrough(page);
      const r = await overflowReport(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
        if (e.closest('.sr-only, .media, .hp, .faq__panel, dialog:not([open]), .svg-sprite, .site-nav__panel:not(.is-open)')) return false;
        const cs = getComputedStyle(e);
        if (!/hidden|clip/.test(cs.overflowY + cs.overflowX)) return false;
        if (!e.offsetParent && cs.position !== 'fixed') return false;
        const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        return hasText && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2);
      }).map(e => e.tagName + '.' + e.className));
      const headerCover = await page.evaluate(() => Math.round(document.querySelector('[data-site-header]').getBoundingClientRect().height / innerHeight * 100));
      check(`${w}px with ${label}: no horizontal overflow and no clipped text`, r.docScroll <= r.vw && r.offenders.length === 0 && clipped.length === 0, JSON.stringify({ offenders: r.offenders.slice(0, 3), clipped: clipped.slice(0, 4), doc: r.docScroll + '/' + r.vw }));
      if (label.startsWith('browser')) check(`${w}px at 200% font: sticky header leaves room to read (uses ${headerCover}% of the viewport height)`, headerCover <= 45, headerCover + '%');
      await page.close();
    }
  }

  /* ================= A9. Live resize interactions ================= */
  section('A9. State survives resizing');
  {
    const page = await open(browser, { width: 390, height: 844 });
    await page.click('[data-menu-toggle]'); await sleep(400);
    await page.setViewport({ width: 1280, height: 800 }); await sleep(600);
    const a = await page.evaluate(() => ({ expanded: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'), locked: document.documentElement.classList.contains('menu-open'), overflow: getComputedStyle(document.documentElement).overflow, bodyOverflow: getComputedStyle(document.body).overflow }));
    check('Mobile menu open, then window widened to desktop: menu state resets and scrolling is not locked', a.expanded === 'false' && !a.locked && a.overflow !== 'hidden' && a.bodyOverflow !== 'hidden', JSON.stringify(a));
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => document.querySelector('.gallery__button').click()); await sleep(700);
    await page.setViewport({ width: 390, height: 844 }); await sleep(600);
    const b = await page.evaluate(() => { const i = document.querySelector('[data-lightbox-image]').getBoundingClientRect(); const c = document.querySelector('[data-lightbox-close]').getBoundingClientRect(); return { img: [Math.round(i.left), Math.round(i.top), Math.round(i.right), Math.round(i.bottom)], close: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], vw: innerWidth, vh: innerHeight, open: document.querySelector('dialog').open }; });
    check('Lightbox open at desktop size, then resized to phone: photo and Close button stay fully on screen', b.open && b.img[0] >= 0 && b.img[2] <= b.vw && b.img[1] >= 0 && b.img[3] <= b.vh && b.close[0] >= 0 && b.close[2] <= b.vw && b.close[1] >= 0, JSON.stringify(b));
    await page.keyboard.press('Escape'); await sleep(500);
    check('Lightbox still closes normally after the resize', !(await page.evaluate(() => document.querySelector('dialog').open)));
    for (let i = 0; i < 3; i++) { await page.setViewport({ width: 1440, height: 900 }); await sleep(250); await page.setViewport({ width: 320, height: 568 }); await sleep(250); }
    await sleep(500);
    const r = await overflowReport(page);
    check('After repeatedly resizing 1440 <-> 320, there is no horizontal overflow', r.docScroll <= r.vw && r.offenders.length === 0, JSON.stringify(r));
    check('No console errors/warnings across the resize tests', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();
  }

  await browser.close();
  process.exitCode = H.summary() ? 1 : 0;
})().catch(e => { console.error('QA SCRIPT CRASHED:', e); process.exit(2); });
