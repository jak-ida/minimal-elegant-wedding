/* QA part B: RSVP form (demo and simulated production), countdown behaviour, gallery/lightbox,
   keyboard navigation, and motion preferences. */
const H = require('./qa-helpers');
const { BASE, sleep, check, note, section, launch, open, scrollThrough, overflowReport } = H;

const jump = (page, sel, offset = 100) => page.evaluate((sel, offset) => {
  const t = document.querySelector(sel);
  window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' });
}, sel, offset);

/* ---------- Simulated RSVP service ---------- */
const PROD = (extra = '', format = 'json') => `Object.assign(window.WEDDING_CONFIG.rsvp,{mode:'production',endpoint:'https://rsvp.test/submit',format:'${format}',timeoutSeconds:2});` + extra;
function makeRoute(state) {
  return async req => {
    if (!req.url().startsWith('https://rsvp.test/')) return false;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, accept', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') { await req.respond({ status: 204, headers: cors }); return true; }
    state.hits.push({ method: req.method(), headers: req.headers(), body: req.postData() });
    if (state.delay) await sleep(state.delay);
    if (state.mode === 'hang') { await sleep(7000); try { await req.abort(); } catch (e) { /* ignore */ } return true; }
    if (state.mode === '500') { await req.respond({ status: 500, headers: cors, contentType: 'application/json', body: '{"ok":false}' }); return true; }
    if (state.mode === 'text') { await req.respond({ status: 200, headers: cors, contentType: 'text/plain', body: 'OK' }); return true; }
    await req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' });
    return true;
  };
}

async function fill(page, f) {
  const typeInto = async (sel, text) => { await page.click(sel, { clickCount: 3 }); await page.keyboard.press('Backspace'); if (text) await page.type(sel, text); };
  if (f.name !== undefined) await typeInto('#rsvp-name', f.name);
  if (f.email !== undefined) await typeInto('#rsvp-email', f.email);
  if (f.attendance) await page.evaluate(v => document.querySelector(`input[name=attendance][value=${v}]`).click(), f.attendance);
  if (f.guests) await page.select('#rsvp-guests', String(f.guests));
  if (f.dietary !== undefined) await typeInto('#rsvp-dietary', f.dietary);
  if (f.message !== undefined) await typeInto('#rsvp-message', f.message);
}
const submit = page => page.evaluate(() => document.querySelector('[data-submit]').click());
const visibleErrors = page => page.evaluate(() => [...document.querySelectorAll('[data-error-for]')].filter(e => !e.hidden).map(e => e.dataset.errorFor + ': ' + e.textContent.replace(/^Error:\s*/, '').trim()));
const successVisible = page => page.evaluate(() => !document.querySelector('[data-rsvp-success]').hidden);
const waitSuccess = (page, ms = 5000) => page.waitForSelector('[data-rsvp-success]:not([hidden])', { timeout: ms }).then(() => true, () => false);

(async () => {
  const browser = await launch();

  /* ================= B1. RSVP form: demo mode ================= */
  section('B1. RSVP form, demo mode (validation, states, keyboard, hostile input)');
  {
    const page = await open(browser, { width: 1280, height: 900 });
    const fresh = async () => { await page.reload({ waitUntil: 'networkidle0' }); await sleep(500); await jump(page, '#rsvp'); await sleep(400); };
    await fresh();

    await fill(page, { name: '     ', email: 'zoe@example.com', attendance: 'declines' }); await submit(page);
    let e = await visibleErrors(page);
    check('Whitespace-only name is rejected with a clear message', e.some(x => /^name: .*full name/i.test(x)), JSON.stringify(e));
    await fill(page, { name: 'A' }); await submit(page);
    e = await visibleErrors(page);
    check('One-character name is rejected ("too short")', e.some(x => /^name: .*too short/i.test(x)), JSON.stringify(e));

    const bad = ['a', 'a@', '@b.co', 'a@b', 'a b@c.co', 'a@b.c', 'a@@b.co', 'a@b..', 'zoe@example'];
    const good = ['a@b.co', 'first.last+tag@sub.example.org', 'zoe@example.com', '  zoe@example.com  ', 'ünï@exämple.com'];
    const wrongBad = [], wrongGood = [];
    await fill(page, { name: 'Zoe Tester', attendance: 'declines' });
    for (const v of bad) { await page.$eval('#rsvp-email', (el, v) => { el.value = v; }, v); await submit(page); if (!(await visibleErrors(page)).some(x => x.startsWith('email'))) wrongBad.push(v); }
    for (const v of good) { await page.$eval('#rsvp-email', (el, v) => { el.value = v; }, v); await submit(page); if ((await visibleErrors(page)).some(x => x.startsWith('email'))) wrongGood.push(v); if (await successVisible(page)) break; }
    check(`Email validation rejects ${bad.length} malformed addresses`, wrongBad.length === 0, JSON.stringify(wrongBad));
    check('Email validation accepts normal addresses (incl. plus-tags, subdomains, accents, surrounding spaces)', wrongGood.length === 0, JSON.stringify(wrongGood));

    await fresh();
    await page.click('#rsvp-name'); await page.keyboard.press('Enter'); await sleep(300);
    e = await visibleErrors(page);
    check('Pressing Enter in an empty form validates it and focuses the first invalid field', e.length === 3 && (await page.evaluate(() => document.activeElement.id)) === 'rsvp-name', JSON.stringify(e));
    await page.type('#rsvp-name', 'Zoe');
    check('Fixing a field removes its error and aria-invalid immediately', !(await visibleErrors(page)).some(x => x.startsWith('name')) && (await page.$eval('#rsvp-name', el => !el.hasAttribute('aria-invalid'))));
    await page.type('#rsvp-email', 'nope'); await page.keyboard.press('Tab'); await sleep(200);
    check('Leaving the email field with a bad value shows the error without submitting', (await visibleErrors(page)).some(x => x.startsWith('email')));
    await page.focus('#rsvp-email'); await page.keyboard.type('@example.com'); await sleep(150);
    check('Typing a valid email clears the error as you type', !(await visibleErrors(page)).some(x => x.startsWith('email')));

    // Keyboard: radios, guests
    await page.focus('input[name=attendance][value=accepts]'); await page.keyboard.press('ArrowRight'); await sleep(150);
    let v = await page.$eval('form', f => f.elements.attendance.value);
    check('Arrow keys move between the two attendance options', v === 'declines', v);
    await page.keyboard.press('ArrowLeft'); await sleep(200);
    const shown = await page.evaluate(() => [...document.querySelectorAll('[data-accept-only]')].every(n => !n.hidden));
    check('Choosing "accepts" with the keyboard reveals the guest and dietary fields', shown);
    await page.focus('#rsvp-guests'); await page.keyboard.press('ArrowDown'); await sleep(100);
    check('Guest count can be changed with the keyboard; options match maxGuests (4)', (await page.$eval('#rsvp-guests', s => s.value + '/' + s.options.length)) === '2/4');

    // maxlength
    await page.type('#rsvp-dietary', 'd'.repeat(520), { delay: 0 });
    await page.type('#rsvp-message', 'm'.repeat(1020), { delay: 0 });
    await page.click('#rsvp-name', { clickCount: 3 }); await page.type('#rsvp-name', 'n'.repeat(130), { delay: 0 });
    const lens = await page.evaluate(() => ({ d: document.getElementById('rsvp-dietary').value.length, m: document.getElementById('rsvp-message').value.length, n: document.getElementById('rsvp-name').value.length }));
    check('Field length limits hold (dietary 500, message 1000, name 120)', lens.d === 500 && lens.m === 1000 && lens.n === 120, JSON.stringify(lens));

    // Tampered select value
    await fresh();
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'accepts' });
    await page.evaluate(() => { const s = document.getElementById('rsvp-guests'); const o = document.createElement('option'); o.value = '9'; o.textContent = '9'; s.appendChild(o); s.value = '9'; });
    await submit(page); await sleep(300);
    e = await visibleErrors(page);
    check('A tampered guest count above the maximum is rejected', e.some(x => /^guests: .*maximum is 4/i.test(x)) && !(await successVisible(page)), JSON.stringify(e));

    // Hostile text
    await fresh();
    const xssName = '<img src=x onerror="window.__xss=1"> Mallory';
    await fill(page, { name: xssName, email: 'm@example.com', attendance: 'accepts', guests: 2, dietary: '<script>window.__xss=2</script>', message: '<b>bold</b> & "quotes" \n second line 😊 محمد' });
    await submit(page);
    const ok = await waitSuccess(page);
    const hostile = await page.evaluate(() => {
      const s = document.querySelector('[data-success-summary]');
      return { xss: window.__xss, injected: s.querySelectorAll('img, b, script').length + document.querySelectorAll('[data-success-title] *').length, texts: [...s.querySelectorAll('dd')].map(d => d.textContent) };
    });
    check('HTML/script typed into the form is shown as plain text and never executes', ok && hostile.xss === undefined && hostile.injected === 0 && hostile.texts.some(t => t.includes('<img')) && hostile.texts.some(t => t.includes('<b>bold</b>')), JSON.stringify(hostile));
    check('Unicode, emoji, RTL text and line breaks are preserved in the confirmation', hostile.texts.some(t => t.includes('😊') && t.includes('محمد')), JSON.stringify(hostile.texts));
    const focused = await page.evaluate(() => document.activeElement.matches('[data-rsvp-success]'));
    check('Success panel receives keyboard focus', focused);
    let acc = null;
    try { const snap = await page.accessibility.snapshot({ root: await page.$('[data-rsvp-success]'), interestingOnly: false }); acc = snap && { role: snap.role, name: snap.name }; } catch (err) { acc = { error: err.message }; }
    check('Success panel has an accessible name and role, so screen readers announce it when focus moves there', acc && acc.name && acc.role !== 'generic' && acc.role !== 'none', JSON.stringify(acc));
    await page.click('[data-rsvp-reset]'); await sleep(300);
    const reset = await page.evaluate(() => ({ form: !document.querySelector('[data-rsvp-form]').hidden, success: document.querySelector('[data-rsvp-success]').hidden, fields: ['rsvp-name', 'rsvp-email', 'rsvp-dietary', 'rsvp-message'].map(i => document.getElementById(i).value).join(''), acceptHidden: [...document.querySelectorAll('[data-accept-only]')].every(n => n.hidden), errors: [...document.querySelectorAll('[data-error-for]')].filter(e => !e.hidden).length, focus: document.activeElement.id, radio: document.querySelector('input[name=attendance]:checked') }));
    check('"Send another response" fully resets: empty fields, hidden extras, no errors, focus on name', reset.form && reset.success && reset.fields === '' && reset.acceptHidden && reset.errors === 0 && reset.focus === 'rsvp-name' && !reset.radio, JSON.stringify(reset));
    await fill(page, { name: 'Second Guest', email: 'two@example.com', attendance: 'declines' }); await submit(page);
    check('A second submission after a reset works', await waitSuccess(page));
    check('No console errors/warnings in demo-mode form tests', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();
  }

  /* ================= B2. RSVP form: simulated production endpoint ================= */
  section('B2. RSVP form, simulated https endpoint (no real service contacted)');
  async function prodPage(state, extra = '', format = 'json', opts = {}) {
    const page = await open(browser, { width: 1280, height: 900, configPatch: PROD(extra, format), routes: makeRoute(state), ...opts });
    await jump(page, '#rsvp'); await sleep(500);
    return page;
  }
  {
    let state = { mode: 'ok', hits: [] };
    let page = await prodPage(state);
    await fill(page, { name: 'Zoë Tester', email: '  Zoe@Example.COM ', attendance: 'accepts', guests: 3, dietary: 'Vegan', message: 'Hello\nthere' });
    await submit(page);
    check('JSON submission succeeds', await waitSuccess(page));
    const hit = state.hits[0];
    let body = null; try { body = JSON.parse(hit.body); } catch (err) { /* ignore */ }
    check('Sent exactly one POST with JSON content type', state.hits.length === 1 && hit.method === 'POST' && /application\/json/.test(hit.headers['content-type']), JSON.stringify({ n: state.hits.length, m: hit.method, ct: hit.headers['content-type'] }));
    check('Payload is correct: trimmed email, guests "3", dietary, multi-line message, ISO timestamp, page without query/hash', body && body.name === 'Zoë Tester' && body.email === 'Zoe@Example.COM' && body.guests === '3' && body.dietary === 'Vegan' && body.message === 'Hello\nthere' && /^\d{4}-\d\d-\d\dT/.test(body.submittedAt) && !/[?#]/.test(body.page), JSON.stringify(body));
    check('No credentials, cookies or Authorization header are sent', !hit.headers['authorization'] && !hit.headers['cookie'], JSON.stringify(Object.keys(hit.headers)));
    check('Production success does not show the "demonstration" disclaimer', !(await page.evaluate(() => !document.querySelector('[data-success-demo]').hidden)));
    check('No console errors/warnings in the production happy path', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();

    state = { mode: 'ok', hits: [], delay: 700 };
    page = await prodPage(state);
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'declines' });
    await submit(page); await submit(page); await page.focus('#rsvp-name'); await page.keyboard.press('Enter'); await sleep(100); await submit(page);
    await waitSuccess(page);
    check('Double-clicking Submit / pressing Enter while sending creates only ONE request', state.hits.length === 1, 'requests: ' + state.hits.length);
    await page.close();

    state = { mode: 'ok', hits: [] };
    page = await prodPage(state);
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'accepts', guests: 4, dietary: 'Nuts' });
    await page.evaluate(() => document.querySelector('input[name=attendance][value=declines]').click()); await sleep(150);
    await submit(page); await waitSuccess(page);
    body = JSON.parse(state.hits[0].body);
    check('Changing to "declines" after typing guest/dietary details sends guests "0" and no dietary text', body.attendance === 'declines' && body.guests === '0' && body.dietary === '', JSON.stringify(body));
    await page.close();

    state = { mode: 'ok', hits: [] };
    page = await prodPage(state);
    await fill(page, { name: 'Bot Person', email: 'bot@example.com', attendance: 'declines' });
    await page.evaluate(() => { document.querySelector('input[name=website]').value = 'http://spam.example'; });
    await submit(page); await sleep(400);
    check('Honeypot filled in: nothing is sent to the server (the bot is told it worked)', state.hits.length === 0 && await successVisible(page), 'requests: ' + state.hits.length);
    await page.close();

    state = { mode: 'ok', hits: [] };
    page = await prodPage(state, '', 'form');
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'declines' }); await submit(page);
    check('Form-data format: submits as multipart/form-data with the field names', await waitSuccess(page) && /multipart\/form-data/.test(state.hits[0].headers['content-type']) && (!state.hits[0].body || /name="email"/.test(state.hits[0].body)), state.hits[0] && state.hits[0].headers['content-type']);
    await page.close();

    state = { mode: '500', hits: [] };
    page = await prodPage(state);
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'accepts', guests: 2, message: 'keep me' });
    await submit(page); await sleep(900);
    let st = await page.evaluate(() => ({ err: !document.querySelector('[data-form-error]').hidden, focus: document.activeElement.matches('[data-form-error]'), btn: !document.querySelector('[data-submit]').disabled, name: document.getElementById('rsvp-name').value, msg: document.getElementById('rsvp-message').value, guests: document.getElementById('rsvp-guests').value, formVisible: !document.querySelector('[data-rsvp-form]').hidden }));
    check('Server error: message shown and focused, form and typed answers kept, button usable again', st.err && st.focus && st.btn && st.name === 'Zoe Tester' && st.msg === 'keep me' && st.guests === '2' && st.formVisible, JSON.stringify(st));
    state.mode = 'ok'; await submit(page);
    check('Retrying after a failure succeeds (2 requests in total)', await waitSuccess(page) && state.hits.length === 2, 'requests: ' + state.hits.length);
    await page.close();

    state = { mode: 'hang', hits: [] };
    page = await prodPage(state);
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'declines' });
    const t0 = Date.now(); await submit(page);
    const sendingText = await page.$eval('[data-submit]', b => b.textContent.trim());
    await page.waitForSelector('[data-form-error]:not([hidden])', { timeout: 6000 }).catch(() => null);
    const waited = Date.now() - t0;
    st = await page.evaluate(() => ({ err: !document.querySelector('[data-form-error]').hidden, btn: !document.querySelector('[data-submit]').disabled }));
    check(`A server that never answers times out after the configured 2 s (took ${waited} ms): error shown, button re-enabled`, st.err && st.btn && waited >= 1800 && waited < 4500, JSON.stringify({ sendingText, waited, st }));
    await page.close();

    state = { mode: 'text', hits: [] };
    page = await prodPage(state);
    await fill(page, { name: 'Zoe Tester', email: 'zoe@example.com', attendance: 'declines' }); await submit(page);
    check('A service that answers 200 with plain text (not JSON) still counts as success', await waitSuccess(page));
    await page.close();
  }

  /* ================= B3. Countdown ================= */
  section('B3. Countdown');
  const pad2 = n => String(n).padStart(2, '0');
  const local = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
  const utc = (ms, offsetMin = 0, suffix = 'Z') => { const d = new Date(ms + offsetMin * 60000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}${suffix}`; };
  const cells = page => page.evaluate(() => { const g = u => document.querySelector(`[data-unit=${u}]`).textContent; return { d: +g('days'), h: +g('hours'), m: +g('minutes'), s: +g('seconds') }; });
  const patchDate = v => `window.WEDDING_CONFIG.wedding.dateTime='${v}';`;
  {
    const target = Date.now() + (2 * 3600 + 5 * 60 + 30) * 1000 + 6000;
    for (const [label, str] of [['local time (no offset)', local(target)], ['UTC "Z"', utc(target)], ['+05:30 offset', utc(target, 330, '+05:30')], ['-08:00 offset', utc(target, -480, '-08:00')]]) {
      const page = await open(browser, { width: 1280, configPatch: patchDate(str) });
      const c = await cells(page);
      check(`Countdown to ${str} (${label}) shows about 2h 05m`, c.d === 0 && c.h === 2 && c.m >= 4 && c.m <= 5, JSON.stringify(c));
      await page.close();
    }

    const texts = [];
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles', 'UTC', 'Asia/Kolkata']) {
      const page = await open(browser, { width: 1280, timezone: tz });
      texts.push(tz + ': ' + await page.evaluate(() => [document.querySelector('.hero__date').textContent, document.querySelector('.hero__badge-date').textContent, document.querySelector('.fact__value:nth-of-type(1)') && [...document.querySelectorAll('.fact__value')][1].textContent].join(' / ')));
      await page.close();
    }
    check('The displayed wedding date and time never shift with the visitor\'s time zone', new Set(texts.map(t => t.split(': ').slice(1).join(': '))).size === 1, JSON.stringify(texts));

    const rem = [];
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles', 'UTC']) {
      const page = await open(browser, { width: 1280, timezone: tz, configPatch: patchDate('2027-06-19T14:30:00+01:00') });
      const c = await cells(page); rem.push(c.d * 86400 + c.h * 3600 + c.m * 60 + c.s); await page.close();
    }
    check('With a typed UTC offset, every visitor in the world sees the same time remaining (within 5 s)', Math.max(...rem) - Math.min(...rem) <= 5, JSON.stringify(rem));

    // Tick integrity
    {
      const page = await open(browser, { width: 1280 });
      const seq = await page.evaluate(async () => { const seen = []; const el = document.querySelector('[data-unit=seconds]'); const t0 = performance.now(); while (performance.now() - t0 < 7500) { const v = +el.textContent; if (!seen.length || seen[seen.length - 1].v !== v) seen.push({ v, t: Math.round(performance.now() - t0) }); await new Promise(r => setTimeout(r, 40)); } return seen; });
      let bad = [];
      for (let i = 1; i < seq.length; i++) { if ((seq[i - 1].v - seq[i].v + 60) % 60 !== 1) bad.push(`${seq[i - 1].v}->${seq[i].v}`); }
      const gaps = seq.slice(2).map((s, i) => s.t - seq[i + 1].t);
      check(`Seconds tick down one at a time with no skips or repeats (${seq.length} samples), ~1 s apart`, bad.length === 0 && seq.length >= 7 && gaps.every(g => g > 850 && g < 1150), JSON.stringify({ bad, gaps }));
      // clock jump (laptop sleeping then waking)
      await page.close();
    }
    {
      const page = await open(browser, { width: 1280, initScript: `window.__skew = 0; const rn = Date.now; Date.now = function () { return rn.call(Date) + window.__skew; };` });
      const before = await cells(page);
      await page.evaluate(() => { window.__skew = 3600000; }); await sleep(1300);
      const after = await cells(page);
      const dHours = (before.d * 24 + before.h) - (after.d * 24 + after.h);
      check('If the computer clock jumps forward 1 hour (sleep/wake), the countdown catches up on the next tick', dHours === 1, JSON.stringify({ before, after }));
      await page.evaluate(() => { window.__skew = 400 * 86400000; }); await sleep(1300);
      const fin = await page.evaluate(() => ({ timer: document.querySelector('[data-countdown]').hidden, msg: !document.querySelector('[data-countdown-message]').hidden, text: document.querySelector('[data-countdown-message]').textContent }));
      check('If the clock jumps past the wedding, the countdown switches to the "past" message', fin.timer && fin.msg && /I do|thank|celebrat/i.test(fin.text), JSON.stringify(fin));
      await page.close();
    }

    // Finishing while the page is open
    for (const [w, mobile] of [[1280, false], [390, true]]) {
      const page = await open(browser, { width: w, height: 800, mobile, configPatch: patchDate(local(Date.now() + 5500)) });
      const hBefore = await page.evaluate(() => Math.round(document.querySelector('.countdown').getBoundingClientRect().height));
      const neg = [];
      const watcher = page.evaluate(async () => { const out = []; const t0 = performance.now(); while (performance.now() - t0 < 4800) { out.push(['days', 'hours', 'minutes', 'seconds'].map(u => document.querySelector(`[data-unit=${u}]`).textContent).join(':')); await new Promise(r => setTimeout(r, 200)); } return out; });
      const samples = await watcher;
      await sleep(2200);
      const fin = await page.evaluate(() => ({ h: Math.round(document.querySelector('.countdown').getBoundingClientRect().height), timerHidden: document.querySelector('[data-countdown]').hidden, msgShown: !document.querySelector('[data-countdown-message]').hidden, msg: document.querySelector('[data-countdown-message]').textContent, summary: document.querySelector('[data-countdown-summary]').textContent, cfg: window.WEDDING_CONFIG.wedding.countdownFinishedMessage }));
      samples.forEach(s => { if (/-/.test(s) || /NaN/.test(s)) neg.push(s); });
      check(`${w}px: when the countdown reaches zero the timer is replaced by the finish message (no negative or NaN values)`, fin.timerHidden && fin.msgShown && fin.msg === fin.cfg && neg.length === 0, JSON.stringify({ fin, last: samples.slice(-2) }));
      check(`${w}px: the finish message and the screen-reader summary match`, fin.summary === fin.msg);
      check(`${w}px: the countdown band does not jump in height when it finishes (${hBefore}px -> ${fin.h}px)`, Math.abs(hBefore - fin.h) <= 40, `${hBefore} -> ${fin.h}`);
      await page.close();
    }

    // Far-future dates / digits
    for (const [label, str] of [['year 2099', '2099-01-01T00:00:00'], ['year 2999', '2999-12-31T23:59:59']]) {
      const bad = [];
      for (const w of [320, 390, 1280]) {
        const page = await open(browser, { width: w, height: 800, mobile: w < 800, configPatch: patchDate(str) });
        const r = await overflowReport(page);
        const geo = await page.evaluate(() => [...document.querySelectorAll('.countdown__unit')].map(u => { const b = u.getBoundingClientRect(); const n = u.querySelector('.countdown__number'); return { unitR: Math.round(b.right), numScroll: n.scrollWidth, numClient: n.clientWidth, text: n.textContent }; }));
        const vw = r.vw;
        if (r.docScroll > vw || r.offenders.length || geo.some(g => g.unitR > vw)) bad.push(`${w}px: ${JSON.stringify({ r, geo })}`);
        await page.close();
      }
      check(`Countdown with ${label} (many digits in the days box) fits at 320, 390 and 1280 px`, bad.length === 0, JSON.stringify(bad));
    }

    // Invalid dates
    const invalid = ['2027-02-30T12:00:00', '2027-13-01T12:00:00', '2027-06-19T25:00:00', '2027-06-19T12:61:00', '2027-6-19', 'banana', ''];
    for (const str of invalid) {
      const page = await open(browser, { width: 1280, configPatch: patchDate(str), settle: 600 });
      const r = await page.evaluate(() => ({ text: document.body.innerText, ready: document.documentElement.classList.contains('js-ready'), hero: document.querySelector('.hero__date').textContent, timerHidden: document.querySelector('[data-countdown]').hidden, names: document.querySelector('.hero__name--one').textContent }));
      const garbage = /Invalid Date|NaN|undefined|\bnull\b/.test(r.text);
      const crash = page.errors.filter(e => /^pageerror/.test(e));
      const rolled = /March|Tuesday, 2|1 January 2028|Sunday, 20/.test(r.hero) && str.startsWith('2027-');
      check(`Invalid date "${str}": page still renders, no "Invalid Date"/NaN text, no silent roll-over to another date, countdown hidden, owner told via console`, r.ready && r.names === 'Amara' && !garbage && crash.length === 0 && r.timerHidden && !rolled && page.errors.length >= 1, JSON.stringify({ hero: r.hero, timerHidden: r.timerHidden, errors: page.errors.length, garbage }));
      await page.close();
    }

    // Screen-reader summary grammar
    {
      const page = await open(browser, { width: 1280, configPatch: patchDate(local(Date.now() + (86400 + 3600 + 60) * 1000 + 30000)) });
      const t = await page.$eval('[data-countdown-summary]', e => e.textContent);
      check('Screen-reader summary uses singular forms ("1 day, 1 hour and 1 minute")', /^1 day, 1 hour and 1 minute/.test(t), t);
      await page.close();
    }

    // Date without time
    {
      const page = await open(browser, { width: 1280, configPatch: patchDate('2027-06-19') });
      const r = await page.evaluate(() => ({ text: document.body.innerText, ceremony: [...document.querySelectorAll('.fact')].find(f => /ceremony/i.test(f.textContent)).textContent.replace(/\s+/g, ' ') }));
      check('A date with no time does not invent a "00:00" ceremony time', !/\b00:00\b|12:00 am/i.test(r.ceremony), r.ceremony.slice(0, 120));
      check('A date with no time causes no console errors', page.errors.length === 0, JSON.stringify(page.errors));
      await page.close();
    }

    // Locales / 12h
    for (const [loc, fmt] of [['en-US', '12h'], ['fr-FR', '24h'], ['de-DE', '24h'], ['ja-JP', '24h'], ['ar-EG', '24h'], ['xx-INVALID', '24h']]) {
      const page = await open(browser, { width: 1280, configPatch: `Object.assign(window.WEDDING_CONFIG.wedding,{locale:'${loc}',timeFormat:'${fmt}'});` });
      const r = await page.evaluate(() => ({ date: document.querySelector('.hero__date').textContent, time: [...document.querySelectorAll('.fact__value')][1].textContent, sched: document.querySelector('.slot__time, .slot time') ? document.querySelector('.slot__time, .slot time').textContent : '' }));
      const fine = r.date && !/NaN|Invalid/.test(r.date + r.time) && page.errors.length === 0 && (fmt !== '12h' || /(AM|PM|am|pm)/.test(r.time));
      check(`Locale ${loc} (${fmt}): dates and times format without errors ("${r.date}" / "${r.time}")`, fine, JSON.stringify({ r, e: page.errors }));
      await page.close();
    }
  }

  /* ================= B4. Gallery and lightbox ================= */
  section('B4. Gallery and lightbox');
  {
    const page = await open(browser, { width: 1280, height: 800 });
    const cfg = await page.evaluate(() => window.WEDDING_CONFIG.gallery.images.map(i => ({ src: i.src, alt: i.alt })));
    await jump(page, '#gallery'); await sleep(900);
    const problems = [];
    for (let i = 0; i < cfg.length; i++) {
      await page.focus(`[data-gallery-index="${i}"]`);
      await page.keyboard.press(i % 2 ? 'Space' : 'Enter'); await sleep(450);
      const s = await page.evaluate(() => { const im = document.querySelector('[data-lightbox-image]'); return { open: document.querySelector('dialog').open, loaded: im.complete && im.naturalWidth > 0, src: im.getAttribute('src'), alt: im.alt, count: document.querySelector('[data-lightbox-count]').textContent }; });
      if (!s.open) problems.push(`#${i + 1} did not open`);
      if (!s.loaded) problems.push(`#${i + 1} image not loaded`);
      if (!s.src.endsWith(cfg[i].src)) problems.push(`#${i + 1} wrong src ${s.src}`);
      if (s.alt !== cfg[i].alt) problems.push(`#${i + 1} wrong alt`);
      if (s.count !== `${i + 1} / ${cfg.length}`) problems.push(`#${i + 1} counter ${s.count}`);
      await page.keyboard.press('Escape'); await sleep(400);
      const back = await page.evaluate(() => document.activeElement.getAttribute('data-gallery-index'));
      if (back !== String(i)) problems.push(`#${i + 1} focus returned to ${back}`);
    }
    check(`All ${cfg.length} photos open from the keyboard (Enter and Space) with the right image, alt text, counter, and focus return`, problems.length === 0, JSON.stringify(problems));

    await page.focus('[data-gallery-index="0"]'); await page.keyboard.press('Enter'); await sleep(450);
    const fwd = [], bwd = [];
    for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowRight'); fwd.push(await page.$eval('[data-lightbox-count]', e => e.textContent.split(' ')[0])); }
    for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowLeft'); bwd.push(await page.$eval('[data-lightbox-count]', e => e.textContent.split(' ')[0])); }
    check('Arrow keys cycle forward through every photo and wrap (2..7,1,2) and back again', fwd.join() === '2,3,4,5,6,7,1,2' && bwd.join() === '1,7,6,5,4,3,2,1', fwd.join() + ' | ' + bwd.join());
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
    check('20 rapid arrow presses stay consistent (1 + 20 wraps to 7 / 7)', (await page.$eval('[data-lightbox-count]', e => e.textContent)) === '7 / 7');
    const rects = await page.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { close: r('[data-lightbox-close]'), prev: r('[data-lightbox-prev]'), next: r('[data-lightbox-next]'), vw: innerWidth, vh: innerHeight }; });
    const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    check('Close, Previous and Next buttons are on screen and do not overlap each other', !overlap(rects.close, rects.prev) && !overlap(rects.close, rects.next) && !overlap(rects.prev, rects.next) && [rects.close, rects.prev, rects.next].every(r => r[0] >= 0 && r[2] <= rects.vw && r[1] >= 0 && r[3] <= rects.vh), JSON.stringify(rects));
    await page.click('[data-lightbox-next]'); await sleep(150); await page.click('[data-lightbox-prev]'); await sleep(150);
    check('Mouse clicks on Next and Previous work', (await page.$eval('[data-lightbox-count]', e => e.textContent)) === '7 / 7');
    await page.keyboard.press('Escape'); await sleep(400);

    // Scroll lock/position and layout shift on open
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await jump(page, '#gallery'); await sleep(400);
    const y0 = await page.evaluate(() => window.scrollY);
    const left0 = await page.evaluate(() => Math.round(document.querySelector('.site-nav').getBoundingClientRect().left));
    await page.evaluate(() => document.querySelector('.gallery__button').click()); await sleep(600);
    const during = await page.evaluate(() => ({ left: Math.round(document.querySelector('.site-nav').getBoundingClientRect().left), y: window.scrollY }));
    await page.keyboard.press('Escape'); await sleep(450);
    const y1 = await page.evaluate(() => window.scrollY);
    check('Opening the lightbox does not shift the page sideways (scrollbar compensation) and the scroll position is restored on close', Math.abs(during.left - left0) <= 1 && Math.abs(y1 - y0) <= 1 && Math.abs(during.y - y0) <= 1, JSON.stringify({ left0, during, y0, y1 }));
    check('No console errors/warnings in desktop gallery tests', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();

    // Fit at many screen sizes: every photo, no distortion
    const fitProblems = [];
    for (const [w, h] of [[1280, 720], [1024, 768], [844, 390], [667, 375], [390, 844], [320, 568], [1920, 1080]]) {
      const p = await open(browser, { width: w, height: h, mobile: w < 800 });
      await jump(p, '#gallery'); await sleep(500);
      await p.evaluate(() => document.querySelector('.gallery__button').click()); await sleep(500);
      for (let i = 0; i < 7; i++) {
        await sleep(200);
        const g = await p.evaluate(() => { const im = document.querySelector('[data-lightbox-image]'); const b = im.getBoundingClientRect(); const c = document.querySelector('[data-lightbox-count]').getBoundingClientRect(); const cl = document.querySelector('[data-lightbox-close]').getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, ratio: b.width / b.height, nat: im.naturalWidth / im.naturalHeight, vw: innerWidth, vh: innerHeight, countOn: c.bottom <= innerHeight + 1 && c.top >= 0, closeOn: cl.left >= 0 && cl.right <= innerWidth && cl.top >= 0 }; });
        if (g.l < -0.5 || g.t < -0.5 || g.r > g.vw + 0.5 || g.b > g.vh + 0.5) fitProblems.push(`${w}x${h} photo ${i + 1} overflows viewport`);
        if (Math.abs(g.ratio - g.nat) > 0.03) fitProblems.push(`${w}x${h} photo ${i + 1} distorted (${g.ratio.toFixed(2)} vs ${g.nat.toFixed(2)})`);
        if (!g.countOn || !g.closeOn) fitProblems.push(`${w}x${h} photo ${i + 1} counter/close off-screen`);
        await p.keyboard.press('ArrowRight');
      }
      await p.close();
    }
    check('Lightbox photos fit the screen undistorted with counter and Close visible (7 photos × 7 screen sizes incl. phone landscape)', fitProblems.length === 0, JSON.stringify(fitProblems.slice(0, 6)));

    // Touch swipe
    const t = await open(browser, { width: 390, height: 844, mobile: true });
    await jump(t, '#gallery'); await sleep(600);
    await t.tap('[data-gallery-index="0"]'); await sleep(600);
    const touchAction = await t.evaluate(() => getComputedStyle(document.querySelector('.lightbox__figure')).touchAction);
    const count = () => t.$eval('[data-lightbox-count]', e => e.textContent);
    const swipe = async (x1, y1, x2, y2) => { await t.touchscreen.touchStart(x1, y1); for (let i = 1; i <= 6; i++) await t.touchscreen.touchMove(x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6); await t.touchscreen.touchEnd(); await sleep(250); };
    const open0 = await count();
    await swipe(300, 420, 90, 420); const afterLeft = await count();
    await swipe(90, 420, 300, 420); const afterRight = await count();
    await swipe(200, 300, 200, 520); const afterDown = await count();
    await swipe(200, 420, 175, 420); const afterShort = await count();
    check('Touch: swiping left goes to the next photo and swiping right goes back', open0 === '1 / 7' && afterLeft === '2 / 7' && afterRight === '1 / 7', JSON.stringify({ open0, afterLeft, afterRight, touchAction }));
    check('Touch: a vertical drag or a short horizontal nudge does NOT change the photo', afterDown === '1 / 7' && afterShort === '1 / 7', JSON.stringify({ afterDown, afterShort }));
    check('The photo area declares touch-action so the browser does not steal horizontal swipes', /pan-y|none|manipulation/.test(touchAction), touchAction);
    await t.tap('[data-lightbox-next]'); await sleep(200);
    check('Touch: tapping the Next button works', (await count()) === '2 / 7');
    await t.tap('[data-lightbox-close]'); await sleep(500);
    check('Touch: tapping Close closes the viewer', !(await t.evaluate(() => document.querySelector('dialog').open)));
    check('No console errors/warnings in touch gallery tests', t.errors.length === 0 && t.warns.length === 0, JSON.stringify({ e: t.errors, w: t.warns }));
    await t.close();
  }

  /* ================= B5. Keyboard ================= */
  section('B5. Keyboard navigation');
  async function walk(page, key = 'Tab', max = 260) {
    const stops = [];
    for (let i = 0; i < max; i++) {
      if (key === 'Shift+Tab') { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); } else { await page.keyboard.press(key); }
      const info = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body || e === document.documentElement) return null;
        const b = e.getBoundingClientRect(); const hdr = document.querySelector('[data-site-header]').getBoundingClientRect(); const cs = getComputedStyle(e);
        return { key: e.tagName + '#' + (e.id || '') + '.' + (typeof e.className === 'string' ? e.className : '') + '|' + (e.getAttribute('href') || e.name || '') + '|' + (e.dataset.galleryIndex || '') + '|' + (e.textContent || '').trim().slice(0, 16), name: (e.getAttribute('aria-label') || e.textContent || e.name || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 30), top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height), vh: innerHeight, hdrBottom: Math.round(hdr.bottom), exempt: !!e.closest('[data-site-header], .banner, .skip-link') || e.matches('.choice__option input'), vis: cs.visibility, display: cs.display, inClosedPanel: !!e.closest('.site-nav__panel') && !document.querySelector('.site-nav__panel.is-open') && getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none', hp: !!e.closest('.hp'), y: Math.round(b.top + scrollY), sec: (e.closest('section') || {}).id || '' };
      });
      if (!info) { stops.cycled = 'left document'; break; }
      if (stops.length > 3 && info.key === stops[0].key) { stops.cycled = 'wrapped to start'; break; }
      stops.push(info);
    }
    return stops;
  }
  for (const [w, h, mobile] of [[1280, 800, false], [390, 844, true]]) {
    const page = await open(browser, { width: w, height: h, mobile });
    await scrollThrough(page);
    const expected = await page.evaluate(() => {
      const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const els = [...document.querySelectorAll(sel)].filter(e => {
        if (e.closest('[hidden], .hp, dialog:not([open]), [inert]')) return false;
        const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        const b = e.getBoundingClientRect(); return (b.width > 0 && b.height > 0) || e.matches('.choice__option input');
      });
      const radioNames = new Set(els.filter(e => e.type === 'radio').map(e => e.name));
      return { count: els.length - els.filter(e => e.type === 'radio').length + radioNames.size, names: els.map(e => (e.getAttribute('aria-label') || e.textContent || e.name || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 24)) };
    });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' }); // measure after focus scrolling has finished, not mid-animation
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.activeElement.blur(); }); await sleep(300);
    const stops = await walk(page);
    const hiddenStops = stops.filter(s => s.hp || s.inClosedPanel || (!s.exempt && (s.w === 0 || s.h === 0 || s.vis === 'hidden')));
    // A tall control (such as the message box) may extend past the screen edge; what matters is that enough of it is in view.
    const obscured = stops.filter(s => !s.exempt && (Math.min(s.bottom, s.vh) - Math.max(s.top, s.hdrBottom)) < Math.min(s.bottom - s.top, 24));
    check(`${w}px: Tab visits ${stops.length} stops and then ${stops.cycled || 'DID NOT LEAVE (possible keyboard trap)'}; every visible control is reachable (expected ${expected.count})`, !!stops.cycled && stops.length >= expected.count - 1 && stops.length <= expected.count + 2, JSON.stringify({ stops: stops.length, expected: expected.count, cycled: stops.cycled }));
    check(`${w}px: Tab never lands on hidden elements, the honeypot, or links inside the closed mobile menu`, hiddenStops.length === 0, JSON.stringify(hiddenStops.map(s => s.name)));
    check(`${w}px: the focused element is never hidden under the sticky header or off the bottom of the screen`, obscured.length === 0, JSON.stringify(obscured.map(s => `${s.name} top=${s.top} bottom=${s.bottom} hdr=${s.hdrBottom}`).slice(0, 5)));
    const inversions = []; let maxY = 0;
    const columnLayouts = []; // laid out in columns on purpose: gallery (CSS columns), travel (two columns on desktop)
    stops.filter(s => !s.exempt).forEach(s => {
      if (s.y < maxY - 40) (/^(gallery|travel)$/.test(s.sec) ? columnLayouts : inversions).push(`${s.name} (${s.sec}, y=${s.y} after ${maxY})`);
      maxY = Math.max(maxY, s.y);
    });
    if (columnLayouts.length) note(`${w}px: ${columnLayouts.length} tab stops in the gallery/travel column layouts follow a lower item (expected for columns; documented in README "Known limitations")`);
    check(`${w}px: tab order follows the visual top-to-bottom order`, inversions.length === 0, JSON.stringify(inversions.slice(0, 5)));
    const back = await walk(page, 'Shift+Tab', stops.length + 6);
    check(`${w}px: Shift+Tab walks back through the same ${stops.length} stops`, back.length >= stops.length - 2 && back.length <= stops.length + 3, `back=${back.length}`);
    check(`${w}px: no console errors/warnings during keyboard walk`, page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();
  }
  {
    // Mobile menu by keyboard
    const page = await open(browser, { width: 390, height: 844, mobile: true });
    await page.focus('[data-menu-toggle]');
    await page.keyboard.press('Enter'); await sleep(350);
    let s = await page.evaluate(() => ({ exp: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'), label: document.querySelector('.menu-toggle__label').textContent }));
    check('Menu opens with Enter (aria-expanded=true, label "Close")', s.exp === 'true' && s.label === 'Close', JSON.stringify(s));
    await page.keyboard.press('Tab');
    check('First Tab after opening moves into the menu links', await page.evaluate(() => !!document.activeElement.closest('.site-nav__panel')));
    await page.keyboard.press('Escape'); await sleep(250);
    s = await page.evaluate(() => ({ exp: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'), onToggle: document.activeElement.matches('[data-menu-toggle]') }));
    check('Escape closes the menu and returns focus to the menu button', s.exp === 'false' && s.onToggle, JSON.stringify(s));
    await page.keyboard.press('Space'); await sleep(300);
    check('Space also toggles the menu', (await page.$eval('[data-menu-toggle]', b => b.getAttribute('aria-expanded'))) === 'true');
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    await sleep(250);
    check('Tabbing out of the open menu closes it so it never covers the page unseen', (await page.$eval('[data-menu-toggle]', b => b.getAttribute('aria-expanded'))) === 'false');
    await page.close();
  }
  {
    // Banner by keyboard and FAQ extras
    const page = await open(browser, { width: 1280, height: 800 });
    await page.focus('[data-banner-close]'); await page.keyboard.press('Enter'); await sleep(400);
    const b = await page.evaluate(() => ({ gone: getComputedStyle(document.querySelector('[data-banner]')).display === 'none' || document.documentElement.classList.contains('banner-dismissed'), focus: document.activeElement.className }));
    check('Banner can be dismissed with the keyboard and focus moves to a sensible place (the logo link)', b.gone && /brand/.test(b.focus), JSON.stringify(b));
    await jump(page, '#faq'); await sleep(400);
    await page.focus('.faq__trigger'); 
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); }
    await sleep(700);
    const faq = await page.evaluate(() => ({ open: [...document.querySelectorAll('.faq__trigger')].filter(t => t.getAttribute('aria-expanded') === 'true').length, visible: [...document.querySelectorAll('.faq__panel')].every(p => p.getBoundingClientRect().height > 0) }));
    check('All six FAQ answers can be open at once and each shows its content', faq.open === 6 && faq.visible, JSON.stringify(faq));
    check('Keyboard focus can reach the e-mail link inside an opened FAQ answer', await (async () => { await page.focus('.faq__item:last-child .faq__trigger'); await page.keyboard.press('Tab'); return page.evaluate(() => document.activeElement.matches('a[href^="mailto:"]')); })());
    await page.close();
  }

  /* ================= B6. Motion preferences ================= */
  section('B6. Motion: reduced motion and normal motion');
  {
    const page = await open(browser, { width: 1280, height: 800, reducedMotion: true, settle: 800 });
    const m = await page.evaluate(() => {
      const running = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().duration > 50).map(a => (a.animationName || a.transitionProperty || a.constructor.name));
      const reveal = [...document.querySelectorAll('[data-reveal]')];
      const hidden = reveal.filter(e => parseFloat(getComputedStyle(e).opacity) < 1 || getComputedStyle(e).transform !== 'none').length;
      const clipped = [...document.querySelectorAll('[data-reveal="mask"] .media')].filter(e => getComputedStyle(e).clipPath !== 'none' && !/inset\(0(px)?( 0(px)?){0,3}\)/.test(getComputedStyle(e).clipPath)).length;
      const scaled = [...document.querySelectorAll('[data-reveal="mask"] .media img')].filter(e => getComputedStyle(e).scale !== 'none' && getComputedStyle(e).scale !== '1').length;
      const dur = s => parseFloat(getComputedStyle(document.querySelector(s)).transitionDuration);
      return { running, total: reveal.length, hidden, clipped, scaled, scroll: getComputedStyle(document.documentElement).scrollBehavior, btn: dur('.btn'), faq: dur('.faq__trigger') };
    });
    check('Reduced motion: no animations are running after load', m.running.length === 0, JSON.stringify(m.running));
    check(`Reduced motion: all ${m.total} reveal elements are fully visible immediately, with no scrolling needed (no opacity/transform/clip/scale left over)`, m.hidden === 0 && m.clipped === 0 && m.scaled === 0, JSON.stringify(m));
    check('Reduced motion: smooth scrolling is off and hover/accordion transitions are effectively instant', m.scroll === 'auto' && m.btn <= 0.01 && m.faq <= 0.01, JSON.stringify({ scroll: m.scroll, btn: m.btn, faq: m.faq }));
    await page.evaluate(() => document.querySelector('.site-nav__list a[href="#faq"]').click()); await sleep(150);
    check('Reduced motion: an in-page link jumps straight to the section (no slow scroll)', await page.evaluate(() => { const t = document.querySelector('#faq').getBoundingClientRect().top; return t < 140 && t > -5; }));
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }); await jump(page, '#gallery'); await sleep(300);
    await page.evaluate(() => document.querySelector('.gallery__button').click()); await sleep(300);
    await page.keyboard.press('Escape'); await sleep(60);
    check('Reduced motion: the lightbox closes instantly (no fade delay)', !(await page.evaluate(() => document.querySelector('dialog').open)));
    check('Reduced motion: no console errors/warnings', page.errors.length === 0 && page.warns.length === 0, JSON.stringify({ e: page.errors, w: page.warns }));
    await page.close();
  }
  {
    const page = await open(browser, { width: 1280, height: 800, settle: 300 });
    const early = await page.evaluate(() => ({ anims: document.getAnimations().length, belowFoldHidden: parseFloat(getComputedStyle(document.querySelector('.faq__list')).opacity) }));
    check('Normal motion: entrance animations exist and below-the-fold content waits for scrolling', early.anims > 0 && early.belowFoldHidden < 1, JSON.stringify(early));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await sleep(500);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 1).length);
    check('Switching on "reduce motion" while the page is open reveals everything straight away', hidden === 0, 'hidden: ' + hidden);
    await page.close();
    for (const [w, mobile] of [[1280, false], [390, true]]) {
      const p = await open(browser, { width: w, height: 800, mobile });
      await scrollThrough(p);
      const still = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 1).map(e => e.className || e.tagName));
      check(`${w}px: after scrolling through, nothing is left invisible by a reveal animation`, still.length === 0, JSON.stringify(still));
      await p.close();
    }
    const q = await open(browser, { width: 1280, height: 800, settle: 200 });
    await q.emulateMediaType('print'); await sleep(300);
    const printHidden = await q.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) < 1 || (getComputedStyle(e).clipPath !== 'none' && getComputedStyle(e).clipPath !== 'inset(0px)')).length);
    check('Printing without scrolling first: no section is printed blank (reveal animations disabled for print)', printHidden === 0, 'hidden when printing: ' + printHidden);
    await q.close();
  }

  await browser.close();
  process.exitCode = H.summary() ? 1 : 0;
})().catch(e => { console.error('QA SCRIPT CRASHED:', e); process.exit(2); });
