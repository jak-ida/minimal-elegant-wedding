/* ==========================================================================
   WEDDING TEMPLATE — INTERACTION LOGIC
   --------------------------------------------------------------------------
   You do not need to edit this file to change wording.
   While <html data-edit> is set, the words live in index.html.
   js/config.js is used again when that editing mode is removed before publishing.

   Contents
     1. Helpers
     2. Derived values (dates, names)
     3. Config validation (developer console warnings)
     4. Theme and static bindings
     5. Content renderers (story, details, schedule, gallery, FAQ, travel...)
     6. Announcement banner
     7. Navigation
     8. Countdown
     9. Lightbox
    10. FAQ accordion
    11. RSVP form and submission adapter
    12. Scroll reveal
    13. Start-up
   ========================================================================== */
(function () {
  'use strict';

  var config = window.WEDDING_CONFIG;
  var editing = document.documentElement.hasAttribute('data-edit');
  var root = document.documentElement;

  if (!config && !editing) {
    console.error('[Wedding template] js/config.js did not load, so no content can be shown.');
    return;
  }

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ----------------------------------------------------------------------
     1. HELPERS
     ---------------------------------------------------------------------- */

  /** Read a nested value such as "story.heading" from an object. */
  function getPath(object, path) {
    return path.split('.').reduce(function (value, key) {
      return value == null ? undefined : value[key];
    }, object);
  }

  /** Create an element safely (all text is inserted as text, never as HTML). */
  function el(tag, props) {
    var node = document.createElement(tag);
    var attrs = props || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style') node.setAttribute('style', value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    for (var i = 2; i < arguments.length; i++) {
      appendChildren(node, arguments[i]);
    }
    return node;
  }

  function appendChildren(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { appendChildren(node, c); }); return; }
    node.append(child);
  }

  function icon(name, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size || 20);
    svg.setAttribute('height', size || 20);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.appendChild(use);
    return svg;
  }

  /**
   * Fill a node with text where "\n" becomes a line break and *word* becomes italic.
   * Uses DOM nodes only, so config values can never inject HTML.
   */
  function setRichText(node, text) {
    node.textContent = '';
    String(text == null ? '' : text).split('\n').forEach(function (line, lineIndex) {
      if (lineIndex > 0) {
        // The space is invisible before a line break, but keeps "we" + "say" from being read as one word.
        node.appendChild(document.createTextNode(' '));
        node.appendChild(document.createElement('br'));
      }
      line.split('*').forEach(function (part, partIndex) {
        if (!part) return;
        if (partIndex % 2 === 1) node.appendChild(el('em', { text: part }));
        else node.appendChild(document.createTextNode(part));
      });
    });
  }

  /** Replace {tokens} in a string. */
  function fillTokens(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  /** Only allow safe link types (blocks "javascript:" and similar). */
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    var url = value.trim();
    if (!url) return '';
    if (/^[\/\\]{2}/.test(url)) return ''; // "//host" and "/\host" would silently point at another site
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(url)) return url;
    if (/^[\w-]+(\/|\.[a-z]+$)/i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    return '';
  }

  function isHttps(value) {
    try { return new URL(value).protocol === 'https:'; } catch (error) { return false; }
  }

  function isDevelopmentHost() {
    var host = window.location.hostname;
    return window.location.protocol === 'file:' || host === '' || host === 'localhost' ||
      host === '127.0.0.1' || host === '[::1]' || /\.local$/.test(host);
  }

  function pad(number, length) {
    var text = String(number);
    while (text.length < (length || 2)) text = '0' + text;
    return text;
  }

  /* ----------------------------------------------------------------------
     2. DERIVED VALUES
     ---------------------------------------------------------------------- */

  /** Split "YYYY-MM-DDTHH:MM:SS(+HH:MM)" into parts. */
  function parseDateTime(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(String(value || '').trim());
    if (!match) return null;
    var offset = match[7] || '';
    if (offset && offset !== 'Z' && offset.indexOf(':') === -1) offset = offset.slice(0, 3) + ':' + offset.slice(3);
    var parts = {
      year: +match[1], month: +match[2], day: +match[3],
      hour: match[4] ? +match[4] : 0, minute: match[5] ? +match[5] : 0, second: match[6] ? +match[6] : 0,
      offset: offset,
      hasTime: !!match[4]
    };
    // Reject impossible values (month 13, 30 February, 25:00) instead of letting Date quietly roll
    // them over into a different day, which would show guests the wrong wedding date.
    var daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
    if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > daysInMonth ||
        parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null;
    if (offset && offset !== 'Z' && (+offset.slice(1, 3) > 14 || +offset.slice(4, 6) > 59)) return null;
    return parts;
  }

  function buildDerived() {
    var locale = config.wedding.locale || 'en-GB';
    var parts = parseDateTime(config.wedding.dateTime);
    var derived = {
      names: config.couple.partnerOne + ' & ' + config.couple.partnerTwo,
      monogram: config.couple.monogram ||
        (config.couple.partnerOne.charAt(0) + ' & ' + config.couple.partnerTwo.charAt(0)).toUpperCase(),
      targetTime: null, displayDate: null, locale: locale
    };

    if (!parts) {
      console.error('[Wedding template] wedding.dateTime ("' + config.wedding.dateTime + '") is not a real date. Use the format "2027-06-19T14:30:00" and check the month, day and time. The date and countdown are hidden until it is fixed.');
      derived.dateLong = ''; derived.dateNumeric = ''; derived.year = '';
      derived.timeLabel = ''; derived.deadlineLong = '';
      derived.copyright = '© ' + derived.names;
      return derived;
    }

    // Display date: built from the typed numbers so it never shifts with time zones.
    var display = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    derived.displayDate = display;

    // Countdown target: exact instant if an offset was typed, otherwise visitor-local time.
    derived.targetTime = parts.offset
      ? new Date(pad(parts.year, 4) + '-' + pad(parts.month) + '-' + pad(parts.day) + 'T' +
          pad(parts.hour) + ':' + pad(parts.minute) + ':' + pad(parts.second) + parts.offset).getTime()
      : display.getTime();

    derived.dateLong = formatDate(display, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    derived.dateNumeric = formatNumericDate(display, locale);
    derived.year = String(parts.year);
    derived.timeLabel = formatTime(display, locale);
    derived.copyright = '© ' + derived.year + ' ' + derived.names;

    var deadlineParts = parseDateTime(config.rsvp.deadline);
    derived.deadlineLong = deadlineParts
      ? formatDate(new Date(deadlineParts.year, deadlineParts.month - 1, deadlineParts.day), locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : String(config.rsvp.deadline || '');
    return derived;
  }

  // Dates are written with the browser's Intl support. If a locale name is wrong, English (UK) is used;
  // if Intl itself is missing or broken (very old or unusual browsers), a plain numeric fallback is used.
  function formatDate(date, locale, options) {
    try { return new Intl.DateTimeFormat(locale, options).format(date); }
    catch (error) {
      try { return new Intl.DateTimeFormat('en-GB', options).format(date); }
      catch (error2) { return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear(); }
    }
  }

  function formatNumericDate(date, locale) {
    var options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    var formatter = null;
    try { formatter = new Intl.DateTimeFormat(locale, options); }
    catch (error) {
      try { formatter = new Intl.DateTimeFormat('en-GB', options); } catch (error2) { formatter = null; }
    }
    if (!formatter) return pad(date.getDate()) + ' · ' + pad(date.getMonth() + 1) + ' · ' + date.getFullYear();
    return formatter.formatToParts(date)
      .filter(function (part) { return part.type === 'day' || part.type === 'month' || part.type === 'year'; })
      .map(function (part) { return part.value; }).join(' · ');
  }

  /** Hide a whole section (and its menu link) when the owner left it with nothing to show. */
  function hideSection(id) {
    var section = document.getElementById(id);
    if (section) section.hidden = true;
    document.querySelectorAll('a[href="#' + id + '"]').forEach(function (link) {
      var item = link.closest('li');
      (item || link).hidden = true;
    });
  }

  function formatTime(date, locale) {
    var hour12 = config.wedding.timeFormat === '12h';
    try { return new Intl.DateTimeFormat(locale, { hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12: hour12 }).format(date); }
    catch (error) { return pad(date.getHours()) + ':' + pad(date.getMinutes()); }
  }

  /** Turn "14:30" into the display format chosen in config (leaves other text alone). */
  function formatScheduleTime(text, derived) {
    var match = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
    if (!match) return { label: String(text), machine: '' };
    var date = new Date(2000, 0, 1, +match[1], +match[2]);
    return { label: formatTime(date, derived.locale), machine: pad(match[1]) + ':' + match[2] };
  }

  var derived = config ? buildDerived() : null;

  /* ----------------------------------------------------------------------
     3. CONFIG VALIDATION (warnings only)
     ---------------------------------------------------------------------- */
  function validateConfig() {
    var warnings = [];
    function checkImage(image, label) {
      if (!image || !image.src) warnings.push(label + ': missing image src.');
      else if (!image.alt) warnings.push(label + ': missing alt text (needed for accessibility).');
      else if (!image.width || !image.height) warnings.push(label + ': add width and height to avoid layout shift.');
    }
    checkImage(config.hero.image, 'hero.image');
    checkImage(config.story.image, 'story.image');
    checkImage(config.finale.image, 'finale.image');
    (config.introductions.people || []).forEach(function (p, i) { checkImage(p.image, 'introductions.people[' + i + '].image'); });
    (config.gallery.images || []).forEach(function (img, i) { checkImage(img, 'gallery.images[' + i + ']'); });
    if ((config.gallery.images || []).length < 6) warnings.push('gallery: at least six images are recommended.');
    if (!(config.rsvp.maxGuests >= 1)) warnings.push('rsvp.maxGuests should be 1 or more.');
    if (config.rsvp.mode === 'production' && !isHttps(config.rsvp.endpoint)) {
      warnings.push('rsvp: mode is "production" but endpoint is missing or not https. The form will run in demo mode.');
    }
    warnings.forEach(function (message) { console.warn('[Wedding template] ' + message); });
  }

  /* ----------------------------------------------------------------------
     4. THEME AND STATIC BINDINGS
     ---------------------------------------------------------------------- */
  function applyTheme() {
    var theme = config.theme || {};
    var colors = theme.colors || {};
    Object.keys(colors).forEach(function (name) {
      if (colors[name]) root.style.setProperty('--color-' + name, colors[name]);
    });
    var fonts = theme.fonts || {};
    if (fonts.heading) root.style.setProperty('--font-heading', fonts.heading);
    if (fonts.body) root.style.setProperty('--font-body', fonts.body);
  }

  function resolveValue(path) {
    if (path.charAt(0) === '@') return derived[path.slice(1)];
    return getPath(config, path);
  }

  function applyBindings() {
    document.title = derived.names + ' | ' + (config.couple.pageTitleSuffix || 'Wedding') +
      (derived.dateLong ? ', ' + derived.dateLong : '');

    document.querySelectorAll('[data-bind]').forEach(function (node) {
      var value = resolveValue(node.getAttribute('data-bind'));
      if (value == null) { console.warn('[Wedding template] No value for ' + node.getAttribute('data-bind')); return; }
      node.textContent = value;
    });

    document.querySelectorAll('[data-bind-rich]').forEach(function (node) {
      var value = resolveValue(node.getAttribute('data-bind-rich'));
      if (value == null) { console.warn('[Wedding template] No value for ' + node.getAttribute('data-bind-rich')); return; }
      setRichText(node, value);
    });

    document.querySelectorAll('[data-bind-href]').forEach(function (node) {
      var url = safeUrl(resolveValue(node.getAttribute('data-bind-href')));
      if (url) node.setAttribute('href', url);
      else node.hidden = true;
    });

    document.querySelectorAll('[data-bind-img]').forEach(function (img) {
      var data = getPath(config, img.getAttribute('data-bind-img'));
      applyImage(img, data);
    });
  }

  /** Apply an image object from config. Skips attributes that already match (avoids re-loading the hero). */
  function applyImage(img, data) {
    if (!data || !data.src) return;
    setIfChanged(img, 'src', data.src);
    if (data.srcset) setIfChanged(img, 'srcset', data.srcset);
    if (data.width) setIfChanged(img, 'width', data.width);
    if (data.height) setIfChanged(img, 'height', data.height);
    setIfChanged(img, 'alt', data.alt || '');
  }

  function setIfChanged(node, name, value) {
    if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value);
  }

  /* ----------------------------------------------------------------------
     5. CONTENT RENDERERS
     ---------------------------------------------------------------------- */
  function mount(name) { return document.querySelector('[data-render="' + name + '"]'); }

  function renderStory() {
    var story = config.story;
    var paragraphs = mount('storyParagraphs');
    if (paragraphs) {
      paragraphs.textContent = '';
      (story.paragraphs || []).forEach(function (text) { paragraphs.appendChild(el('p', { text: text })); });
    }

    var list = mount('milestones');
    if (list) {
      list.textContent = '';
      if (!(story.milestones || []).length && list.parentElement) list.parentElement.hidden = true; // no dates: no heading either
      (story.milestones || []).forEach(function (item, index) {
        list.appendChild(el('li', { class: 'milestone', 'data-reveal': '', style: '--i:' + index },
          el('span', { class: 'milestone__date', text: item.date }),
          el('h4', { class: 'milestone__title', text: item.title }),
          el('p', { class: 'milestone__text', text: item.text })
        ));
      });
    }
  }

  function renderPeople() {
    var section = document.querySelector('[data-couple-section]');
    var intros = config.introductions;
    if (!intros.enabled || !(intros.people || []).length) {
      if (section) section.remove();
      return;
    }
    var grid = mount('people');
    grid.textContent = '';
    intros.people.forEach(function (person, index) {
      var img = el('img', { alt: '', loading: 'lazy', decoding: 'async', sizes: '(min-width: 760px) 40vw, 80vw', width: 864, height: 1152 });
      applyImage(img, person.image);

      grid.appendChild(el('article', { class: 'person' },
        el('div', { class: 'person__photo', 'data-reveal': 'mask' }, el('div', { class: 'media' }, img)),
        el('div', { class: 'person__text', 'data-reveal': '', style: '--i:1' },
          person.role ? el('p', { class: 'person__role', text: person.role }) : null,
          el('h3', { class: 'person__name', text: person.name }),
          el('p', { class: 'person__bio', text: person.bio }),
          person.quote ? el('blockquote', { class: 'person__quote' }, el('p', { text: '\u201C' + person.quote + '\u201D' })) : null,
          person.detail ? el('p', { class: 'person__detail', text: person.detail }) : null
        )
      ));
    });
  }

  function renderDetails() {
    var d = config.details;
    var labels = d.labels || {};
    var list = mount('details');
    if (!list) return;
    list.textContent = '';

    var addressLines = (d.venueAddress || []).map(function (line, i) {
      return [i ? el('br') : null, document.createTextNode(line)];
    });

    var facts = [
      { label: labels.date, value: derived.dateLong },
      { label: labels.ceremony, value: derived.timeLabel, text: d.ceremony },
      { label: labels.venue, value: d.venueName, nodes: addressLines },
      { label: labels.reception, value: d.receptionVenue, text: d.reception },
      // A short summary line (serif) plus a note keeps every row in the same visual pattern.
      // Without a summary, the long text falls back to a single larger paragraph.
      { label: labels.dressCode, value: d.dressCodeSummary, text: d.dressCode, textLarge: !d.dressCodeSummary },
      d.parking ? { label: labels.parking, value: d.parkingSummary, text: d.parking, textLarge: !d.parkingSummary } : null
    ].filter(Boolean);

    facts.forEach(function (fact, index) {
      list.appendChild(el('div', { class: 'fact', 'data-reveal': '', style: '--i:' + (index % 2) },
        el('dt', { class: 'fact__label', text: fact.label }),
        el('dd', { class: 'fact__body' },
          fact.value ? el('span', { class: 'fact__value', text: fact.value }) : null,
          fact.text ? el('span', { class: fact.textLarge ? 'fact__text fact__text--large' : 'fact__text', text: fact.text }) : null,
          fact.nodes ? el('span', { class: 'fact__text' }, fact.nodes) : null
        )
      ));
    });
  }

  function renderSchedule() {
    var list = mount('schedule');
    if (!list) return;
    list.textContent = '';
    if (!(config.schedule.events || []).length) { hideSection('schedule'); return; }
    (config.schedule.events || []).forEach(function (event, index) {
      var time = formatScheduleTime(event.time, derived);
      list.appendChild(el('li', { class: 'slot', 'data-reveal': '', style: '--i:' + Math.min(index, 3) },
        time.machine
          ? el('time', { class: 'slot__time', datetime: time.machine, text: time.label })
          : el('span', { class: 'slot__time', text: time.label }),
        el('div', { class: 'slot__body' },
          el('h3', { class: 'slot__title', text: event.title }),
          event.text ? el('p', { class: 'slot__text', text: event.text }) : null
        )
      ));
    });
  }

  function renderGallery() {
    var list = mount('gallery');
    if (!list) return;
    list.textContent = '';
    var images = config.gallery.images || [];
    if (!images.length) { hideSection('gallery'); return; }
    images.forEach(function (image, index) {
      var img = el('img', {
        alt: image.alt || '', loading: 'lazy', decoding: 'async',
        sizes: '(min-width: 960px) 30vw, (min-width: 600px) 46vw, 92vw'
      });
      applyImage(img, image);
      var label = 'Open photo ' + (index + 1) + ' of ' + images.length + ': ' + (image.alt || '');
      list.appendChild(el('li', { class: 'gallery__item', 'data-reveal': 'mask' },
        el('button', {
          class: 'gallery__button', type: 'button', 'data-gallery-index': index,
          'aria-haspopup': 'dialog', 'aria-label': label
        }, el('span', { class: 'media' }, img))
      ));
    });
  }

  /** Replace {deadline} and {contact} inside text, turning an email address into a link. */
  function buildAnswer(text) {
    var contact = config.faq.contact || '';
    var withDeadline = fillTokens(text, { deadline: derived.deadlineLong });
    var pieces = withDeadline.split('{contact}');
    var nodes = [];
    pieces.forEach(function (piece, i) {
      if (i > 0) {
        if (/^[^\s@]+@[^\s@]+$/.test(contact)) nodes.push(el('a', { href: 'mailto:' + contact, text: contact }));
        else nodes.push(document.createTextNode(contact));
      }
      nodes.push(document.createTextNode(piece));
    });
    return nodes;
  }

  function renderFaq() {
    var wrapper = mount('faq');
    if (!wrapper) return;
    wrapper.textContent = '';
    if (!(config.faq.items || []).length) { hideSection('faq'); return; }
    (config.faq.items || []).forEach(function (item, index) {
      var triggerId = 'faq-trigger-' + index;
      var panelId = 'faq-panel-' + index;
      wrapper.appendChild(el('div', { class: 'faq__item' },
        el('h3', { class: 'faq__heading' },
          el('button', { class: 'faq__trigger', type: 'button', id: triggerId, 'aria-expanded': 'false', 'aria-controls': panelId },
            el('span', { class: 'faq__question', text: item.q }),
            el('span', { class: 'faq__icon', 'aria-hidden': 'true' }, icon('plus', 22))
          )
        ),
        el('div', { class: 'faq__panel', id: panelId, role: 'region', 'aria-labelledby': triggerId },
          el('div', { class: 'faq__panel-inner' }, el('p', null, buildAnswer(item.a)))
        )
      ));
    });
  }

  function renderTravel() {
    var travel = config.travel;
    var details = config.details;

    var address = mount('venueAddress');
    if (address) {
      address.textContent = '';
      (details.venueAddress || []).forEach(function (line, i) {
        if (i) address.appendChild(el('br'));
        address.appendChild(document.createTextNode(line));
      });
    }

    var notes = mount('travelNotes');
    if (notes) {
      notes.textContent = '';
      (travel.notes || []).forEach(function (text) { notes.appendChild(el('li', { text: text })); });
      if (!(travel.notes || []).length) notes.hidden = true;
    }

    var stays = mount('stays');
    if (stays) {
      stays.textContent = '';
      if (!(travel.accommodations || []).length && stays.parentElement) stays.parentElement.hidden = true; // no hotels: no "Where to stay" heading
      (travel.accommodations || []).forEach(function (stay) {
        var url = safeUrl(stay.url);
        stays.appendChild(el('li', { class: 'stay' },
          el('div', { class: 'stay__main' },
            el('h4', { class: 'stay__name', text: stay.name }),
            el('p', { class: 'stay__note', text: stay.note }),
            stay.placeholder ? el('p', { class: 'stay__placeholder', text: travel.placeholderLabel || 'Sample listing' }) : null
          ),
          el('div', { class: 'stay__side' },
            stay.price ? el('p', { class: 'stay__price', text: stay.price }) : null,
            url ? el('a', { class: 'stay__link', href: url, target: '_blank', rel: 'noopener noreferrer' },
              travel.linkLabel || 'View details',
              el('span', { class: 'sr-only', text: ' for ' + stay.name + ' (opens in a new tab)' })
            ) : null
          )
        ));
      });
    }
  }

  function renderFooter() {
    var socials = mount('socials');
    if (socials) {
      socials.textContent = '';
      var any = false;
      (config.footer.socials || []).forEach(function (item) {
        var url = safeUrl(item.url);
        if (!url) return;
        any = true;
        socials.appendChild(el('li', null,
          el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, item.label,
            el('span', { class: 'sr-only', text: ' (opens in a new tab)' }))
        ));
      });
      if (!any) socials.hidden = true;
    }

    var attribution = document.querySelector('[data-attribution]');
    if (attribution && config.footer.showAttribution && config.footer.attributionText) {
      attribution.textContent = '';
      var url = safeUrl(config.footer.attributionUrl);
      attribution.appendChild(url
        ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: config.footer.attributionText })
        : document.createTextNode(config.footer.attributionText));
      attribution.hidden = false;
    }
  }

  /* ----------------------------------------------------------------------
     6. ANNOUNCEMENT BANNER
     ---------------------------------------------------------------------- */
  function initBanner() {
    var banner = document.querySelector('[data-banner]');
    if (!banner) return;
    if (!config.banner.enabled) { banner.remove(); return; }

    var close = banner.querySelector('[data-banner-close]');
    if (config.banner.dismissible) {
      close.hidden = false;
      close.addEventListener('click', function () {
        try { window.sessionStorage.setItem('wedding-banner-dismissed', '1'); } catch (error) { /* ignore */ }
        root.classList.add('banner-dismissed');
        var brand = document.querySelector('.brand');
        if (brand) brand.focus();
      });
    }
  }

  /* ----------------------------------------------------------------------
     7. NAVIGATION
     ---------------------------------------------------------------------- */
  function initNavigation() {
    var header = document.querySelector('[data-site-header]');
    var toggle = document.querySelector('[data-menu-toggle]');
    var panel = document.querySelector('[data-menu-panel]');
    if (!header || !toggle || !panel) return;

    var label = toggle.querySelector('.menu-toggle__label');
    var desktop = window.matchMedia('(min-width: 60rem)');

    function setOpen(open, returnFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open && !desktop.matches);
      if (label) label.textContent = open ? 'Close' : 'Menu';
      if (!open && returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !header.contains(event.target)) setOpen(false);
    });

    // If keyboard focus leaves the menu, close it so it never covers the page unseen.
    header.addEventListener('focusout', function (event) {
      if (event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });

    desktop.addEventListener('change', function () { setOpen(false); });

    // Keep scroll offset in sync with the real header height (used by CSS scroll-padding).
    function measure() { root.style.setProperty('--nav-h', header.offsetHeight + 'px'); }
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(header);
    else window.addEventListener('resize', measure);

    // Subtle style change once the page scrolls.
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
        ticking = false;
      });
    }, { passive: true });

    // Mark the current section in the menu.
    if ('IntersectionObserver' in window) {
      var links = Array.prototype.slice.call(panel.querySelectorAll('a[href^="#"]:not(.btn)'));
      var map = {};
      links.forEach(function (link) {
        var target = document.getElementById(link.getAttribute('href').slice(1));
        if (target) map[target.id] = link;
      });
      var current = null;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (current) current.removeAttribute('aria-current');
          current = map[entry.target.id];
          if (current) current.setAttribute('aria-current', 'location');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { observer.observe(document.getElementById(id)); });
    }
  }

  /* ----------------------------------------------------------------------
     8. COUNTDOWN
     ---------------------------------------------------------------------- */
  function initCountdown() {
    var timer = document.querySelector('[data-countdown]');
    if (!timer) return;

    var cells = {};
    timer.querySelectorAll('[data-unit]').forEach(function (node) { cells[node.getAttribute('data-unit')] = node; });
    var summary = document.querySelector('[data-countdown-summary]');
    var message = document.querySelector('[data-countdown-message]');
    var labels, singularLabels, summaryTemplate, targetTime, dateLong, finishedMessage, pastTemplate;
    var lastSummaryMinute = -1;
    var timeoutId = null;

    if (editing) {
      var parts = parseDateTime(timer.getAttribute('data-target'));
      if (!parts) { timer.hidden = true; return; }
      var display = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      var locale = timer.getAttribute('data-locale') || 'en-GB';
      targetTime = display.getTime();
      dateLong = formatDate(display, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      finishedMessage = timer.getAttribute('data-finished') || '';
      pastTemplate = timer.getAttribute('data-past') || '';
      labels = {};
      singularLabels = {};
      ['days', 'hours', 'minutes', 'seconds'].forEach(function (key) {
        var label = timer.querySelector('[data-label="' + key + '"]');
        if (!label) return;
        labels[key] = label.textContent;
        singularLabels[key] = label.getAttribute('data-singular') || label.textContent;
      });
      summaryTemplate = timer.getAttribute('data-summary') || '{days}, {hours} and {minutes} until the wedding.';
    } else {
      labels = (config.countdown && config.countdown.labels) || {};
      singularLabels = (config.countdown && config.countdown.labelsSingular) || {};
      summaryTemplate = (config.countdown && config.countdown.summary) || '{days}, {hours} and {minutes} until the wedding.';
      targetTime = derived.targetTime;
      dateLong = derived.dateLong;
      finishedMessage = config.wedding.countdownFinishedMessage;
      pastTemplate = config.wedding.countdownPastMessage;
      if (targetTime == null) { timer.hidden = true; return; }
    }

    function showFinished(msSincePast) {
      timer.hidden = true;
      message.hidden = false;
      var text = msSincePast < 86400000
        ? finishedMessage
        : fillTokens(pastTemplate, { date: dateLong });
      message.textContent = text;
      if (summary) summary.textContent = text;
    }

    function update() {
      var diff = targetTime - Date.now();
      if (diff <= 0) { showFinished(-diff); return false; }

      var totalSeconds = Math.floor(diff / 1000);
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor((totalSeconds % 86400) / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;

      var dayText = pad(days, days > 99 ? 3 : 2);
      cells.days.textContent = dayText;
      // Very distant dates have more digits; let the stylesheet shrink them to fit their box.
      var dayBox = cells.days.closest('.countdown__unit');
      if (dayBox) {
        if (dayText.length > 3) { dayBox.setAttribute('data-long', ''); dayBox.style.setProperty('--digits', dayText.length); }
        else { dayBox.removeAttribute('data-long'); }
      }
      cells.hours.textContent = pad(hours);
      cells.minutes.textContent = pad(minutes);
      cells.seconds.textContent = pad(seconds);

      // Screen-reader text changes at most once a minute and is not a live region.
      var minuteKey = Math.floor(totalSeconds / 60);
      if (summary && minuteKey !== lastSummaryMinute) {
        lastSummaryMinute = minuteKey;
        summary.textContent = fillTokens(summaryTemplate, {
          days: unitText(days, 'days'), hours: unitText(hours, 'hours'), minutes: unitText(minutes, 'minutes')
        });
      }
      return true;
    }

    // "1 day" but "2 days": singular words come from countdown.labelsSingular (falls back to the plural label).
    function unitText(count, key) {
      var plural = String(labels[key] || key).toLowerCase();
      var singular = String(singularLabels[key] || labels[key] || key).toLowerCase();
      return count + ' ' + (count === 1 ? singular : plural);
    }

    function schedule() {
      if (!update()) return;
      timeoutId = window.setTimeout(schedule, 1000 - (Date.now() % 1000) + 5);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { window.clearTimeout(timeoutId); schedule(); }
    });
    schedule();
  }

  /* ----------------------------------------------------------------------
     9. LIGHTBOX
     ---------------------------------------------------------------------- */
  function initLightbox() {
    var dialog = document.querySelector('[data-lightbox]');
    var grid = mount('gallery');
    if (!dialog || !grid) return;
    var images = (!editing && config && config.gallery && config.gallery.images) ? config.gallery.images : Array.prototype.map.call(grid.querySelectorAll('[data-gallery-index] img'), function (img) {
      return {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        width: img.getAttribute('width'),
        height: img.getAttribute('height')
      };
    });
    if (!images.length) return;

    var figure = dialog.querySelector('.lightbox__figure');
    var imgEl = dialog.querySelector('[data-lightbox-image]');
    var countEl = dialog.querySelector('[data-lightbox-count]');
    var prevBtn = dialog.querySelector('[data-lightbox-prev]');
    var nextBtn = dialog.querySelector('[data-lightbox-next]');
    var closeBtn = dialog.querySelector('[data-lightbox-close]');
    var supportsDialog = typeof dialog.showModal === 'function';

    var index = 0;
    var trigger = null;
    var closing = false;

    if (images.length < 2) { prevBtn.hidden = true; nextBtn.hidden = true; }

    function show(newIndex) {
      index = (newIndex + images.length) % images.length;
      var image = images[index];
      imgEl.classList.remove('is-ready');
      imgEl.alt = image.alt || '';
      if (image.width) imgEl.width = image.width;
      if (image.height) imgEl.height = image.height;
      imgEl.onload = imgEl.onerror = function () { imgEl.classList.add('is-ready'); };
      imgEl.src = image.src;
      if (imgEl.complete) imgEl.classList.add('is-ready');
      countEl.textContent = (index + 1) + ' / ' + images.length;

      // Warm the cache for the neighbouring photos.
      [index - 1, index + 1].forEach(function (i) {
        var neighbour = images[(i + images.length) % images.length];
        if (neighbour) { var pre = new Image(); pre.src = neighbour.src; }
      });
    }

    function scrollbarGap() {
      return Math.max(0, window.innerWidth - root.clientWidth);
    }

    function open(newIndex, opener) {
      trigger = opener || null;
      closing = false;
      show(newIndex);
      root.style.setProperty('--scrollbar-gap', scrollbarGap() + 'px');
      root.classList.add('lightbox-open');
      dialog.classList.remove('is-closing');
      if (supportsDialog) dialog.showModal(); else dialog.setAttribute('open', '');
      closeBtn.focus();
    }

    function finishClose() {
      if (supportsDialog) dialog.close(); else dialog.removeAttribute('open');
      dialog.classList.remove('is-closing');
      root.classList.remove('lightbox-open');
      root.style.removeProperty('--scrollbar-gap');
      closing = false;
      if (trigger && document.contains(trigger)) trigger.focus();
    }

    function close() {
      if (closing) return;
      closing = true;
      if (prefersReducedMotion.matches) { finishClose(); return; }
      dialog.classList.add('is-closing');
      window.setTimeout(finishClose, 200);
    }

    grid.addEventListener('click', function (event) {
      var button = event.target.closest('[data-gallery-index]');
      if (button) open(Number(button.getAttribute('data-gallery-index')), button);
    });

    prevBtn.addEventListener('click', function () { show(index - 1); });
    nextBtn.addEventListener('click', function () { show(index + 1); });
    closeBtn.addEventListener('click', close);

    // Click on the dark area (anything that is not the photo or a button) closes.
    dialog.addEventListener('click', function (event) {
      if (!event.target.closest('img, button')) close();
    });

    // Native Escape handling: use our animated close instead.
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
      else if (event.key === 'Escape' && !supportsDialog) { close(); }
    });

    // Swipe left/right on touch screens.
    var startX = null;
    var startY = null;
    figure.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse') return;
      startX = event.clientX; startY = event.clientY;
    });
    figure.addEventListener('pointerup', function (event) {
      if (startX == null) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      startX = startY = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) show(index + (dx < 0 ? 1 : -1));
    });
    figure.addEventListener('pointercancel', function () { startX = startY = null; });
  }

  /* ----------------------------------------------------------------------
     10. FAQ ACCORDION
     ---------------------------------------------------------------------- */
  function initGifts() {
    var dialog = document.querySelector('[data-gifts-modal]');
    var openBtn = document.querySelector('[data-gifts-open]');
    if (!dialog || !openBtn) return;
    var closeBtn = dialog.querySelector('[data-gifts-close]');
    var supportsDialog = typeof dialog.showModal === 'function';

    function open() {
      document.documentElement.classList.add('lightbox-open');
      dialog.classList.remove('is-closing');
      if (supportsDialog) dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function close() {
      if (supportsDialog && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      document.documentElement.classList.remove('lightbox-open');
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('lightbox-open');
    });
  }

  function initFaq() {
    var wrapper = mount('faq');
    if (!wrapper) return;
    var triggers = Array.prototype.slice.call(wrapper.querySelectorAll('.faq__trigger'));

    function setExpanded(trigger, expanded) {
      trigger.setAttribute('aria-expanded', String(expanded));
      trigger.closest('.faq__item').classList.toggle('is-open', expanded);
    }

    wrapper.addEventListener('click', function (event) {
      var trigger = event.target.closest('.faq__trigger');
      if (!trigger) return;
      setExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true');
    });

    wrapper.addEventListener('keydown', function (event) {
      var trigger = event.target.closest('.faq__trigger');
      if (!trigger) return;
      var position = triggers.indexOf(trigger);
      var next = null;
      if (event.key === 'ArrowDown') next = triggers[(position + 1) % triggers.length];
      else if (event.key === 'ArrowUp') next = triggers[(position - 1 + triggers.length) % triggers.length];
      else if (event.key === 'Home') next = triggers[0];
      else if (event.key === 'End') next = triggers[triggers.length - 1];
      if (next) { event.preventDefault(); next.focus(); }
    });
  }

  /* The floral image sits inside the band and drifts more slowly than the page. */
  function initParallax() {
    var layers = document.querySelectorAll('[data-parallax]');
    if (!layers.length || prefersReducedMotion.matches) return;

    var ticking = false;
    function update() {
      var viewH = window.innerHeight || 0;
      Array.prototype.forEach.call(layers, function (layer) {
        var section = layer.parentElement;
        if (!section) return;
        var rect = section.getBoundingClientRect();
        var travel = -(rect.top + rect.height / 2 - viewH / 2) * 0.35;
        var limit = section.offsetHeight * 0.2;
        if (travel > limit) travel = limit;
        if (travel < -limit) travel = -limit;
        layer.style.transform = 'translate3d(0,' + travel.toFixed(2) + 'px,0)';
      });
      ticking = false;
    }
    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    prefersReducedMotion.addEventListener('change', function (event) {
      if (event.matches) {
        Array.prototype.forEach.call(layers, function (layer) { layer.style.transform = ''; });
      } else {
        requestUpdate();
      }
    });
    requestUpdate();
  }

  /* ----------------------------------------------------------------------
     11. RSVP FORM AND SUBMISSION ADAPTER
     ---------------------------------------------------------------------- */
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /**
   * RSVP ADAPTER
   * Demo mode: waits briefly and reports success without sending anything.
   * Production mode: sends the payload to the https endpoint from config.
   * Returns a promise that resolves to { demo: boolean } or rejects with an Error.
   */
  function rsvpSettings(form) {
    if (config && config.rsvp) return config.rsvp;
    return {
      mode: form.getAttribute('data-mode') || 'demo',
      endpoint: form.getAttribute('data-endpoint') || '',
      method: form.getAttribute('data-method') || 'POST',
      format: form.getAttribute('data-format') || 'form',
      timeoutSeconds: Number(form.getAttribute('data-timeout')) || 15,
      maxGuests: Number(form.getAttribute('data-max-guests')) || 4,
      demoNotice: form.getAttribute('data-demo-notice') || '',
      demoSuccess: form.getAttribute('data-demo-success') || '',
      successTitle: form.getAttribute('data-success-title') || 'Thank you, {name}',
      successAccept: form.getAttribute('data-success-accept') || '',
      successDecline: form.getAttribute('data-success-decline') || '',
      errorMessage: form.getAttribute('data-error-message') || 'We could not send your response. Please check your connection and try again, or contact us directly.'
    };
  }

  function submitRsvp(payload) {
    var rsvp = rsvpSettings(document.querySelector('[data-rsvp-form]'));
    var productionReady = rsvp.mode === 'production' && isHttps(rsvp.endpoint);

    if (!productionReady) {
      return new Promise(function (resolve) {
        window.setTimeout(function () { resolve({ demo: true }); }, 800);
      });
    }

    var controller = 'AbortController' in window ? new AbortController() : null;
    var timeoutMs = (rsvp.timeoutSeconds || 15) * 1000;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, timeoutMs) : null;

    var request = { method: rsvp.method || 'POST', headers: { 'Accept': 'application/json' } };
    if (controller) request.signal = controller.signal;

    if (rsvp.format === 'json') {
      request.headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(payload);
    } else {
      var form = new FormData();
      Object.keys(payload).forEach(function (key) { form.append(key, payload[key]); });
      request.body = form;
    }

    return fetch(rsvp.endpoint, request).then(function (response) {
      if (timer) window.clearTimeout(timer);
      if (!response.ok) throw new Error('Server responded with status ' + response.status);
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (body && (body.ok === false || body.success === false || body.error)) {
          throw new Error('The RSVP service reported an error.');
        }
        return { demo: false };
      });
    }).catch(function (error) {
      if (timer) window.clearTimeout(timer);
      throw error;
    });
  }

  function initRsvp() {
    var form = document.querySelector('[data-rsvp-form]');
    if (!form) return;

    var rsvp = rsvpSettings(form);
    var maxGuests = Math.max(1, Math.floor(Number(rsvp.maxGuests) || 1));
    var successPanel = document.querySelector('[data-rsvp-success]');
    var submitButton = form.querySelector('[data-submit]');
    var submitLabel = submitButton.querySelector('.btn__label');
    var formError = form.querySelector('[data-form-error]');
    var guestsSelect = form.elements.guests;
    var acceptOnly = Array.prototype.slice.call(form.querySelectorAll('[data-accept-only]'));
    var demoNotice = document.querySelector('[data-demo-notice]');
    var sending = false;
    var defaultLabel = submitLabel.textContent;

    var productionReady = rsvp.mode === 'production' && isHttps(rsvp.endpoint);

    // Demo notice (shown on local/test hosts so it is never mistaken for a live form).
    if (!productionReady) {
      var notice = rsvp.mode === 'production'
        ? 'RSVP mode is "production" but no valid https endpoint is set. Running in demo mode. Nothing is sent or stored.'
        : rsvp.demoNotice;
      console.warn('[Wedding template] RSVP is in demo mode: responses are not stored or sent. See README.md.');
      if (isDevelopmentHost()) { demoNotice.textContent = notice; demoNotice.hidden = false; }
    }

    // Guest count options are built from the configured maximum.
    if (!guestsSelect.options.length) {
      for (var n = 1; n <= maxGuests; n++) {
        guestsSelect.appendChild(el('option', { value: n, text: String(n) }));
      }
    }

    var fieldNames = ['name', 'email', 'attendance', 'guests'];

    function errorNode(name) { return form.querySelector('[data-error-for="' + name + '"]'); }

    function fieldElements(name) {
      var field = form.elements[name];
      if (!field) return [];
      return field.length !== undefined && !field.tagName ? Array.prototype.slice.call(field) : [field];
    }

    function setError(name, message) {
      var node = errorNode(name);
      if (!node) return;
      var fields = fieldElements(name);
      if (message) {
        node.textContent = '';
        node.appendChild(el('span', { class: 'sr-only', text: 'Error: ' }));
        node.appendChild(document.createTextNode(message));
        node.hidden = false;
        fields.forEach(function (f) { f.setAttribute('aria-invalid', 'true'); });
      } else {
        node.hidden = true;
        node.textContent = '';
        fields.forEach(function (f) { f.removeAttribute('aria-invalid'); });
      }
    }

    function validateField(name) {
      var message = '';
      var value = '';
      if (name === 'name') {
        value = form.elements.name.value.trim();
        if (!value) message = 'Please enter your full name.';
        else if (value.length < 2) message = 'Your name looks too short. Please enter your full name.';
      } else if (name === 'email') {
        value = form.elements.email.value.trim();
        if (!value) message = 'Please enter your email address.';
        else if (!EMAIL_PATTERN.test(value)) message = 'That email address does not look right. Try something like name@example.com.';
      } else if (name === 'attendance') {
        if (!form.elements.attendance.value) message = 'Please tell us whether you can attend.';
      } else if (name === 'guests') {
        if (form.elements.attendance.value === 'accepts') {
          var count = Number(guestsSelect.value);
          if (!Number.isInteger(count) || count < 1) message = 'Please choose how many guests are coming.';
          else if (count > maxGuests) message = 'The maximum is ' + maxGuests + ' guests per response.';
        }
      }
      setError(name, message);
      return !message;
    }

    function validateAll() {
      var firstInvalid = null;
      fieldNames.forEach(function (name) {
        if (!validateField(name) && !firstInvalid) firstInvalid = name;
      });
      return firstInvalid;
    }

    function focusField(name) {
      var fields = fieldElements(name);
      if (fields.length) fields[0].focus();
    }

    function updateAttendanceView() {
      var accepts = form.elements.attendance.value === 'accepts';
      acceptOnly.forEach(function (node) { node.hidden = !accepts; });
      if (!accepts) { setError('guests', ''); }
    }

    form.addEventListener('change', function (event) {
      if (event.target.name === 'attendance') {
        updateAttendanceView();
        validateField('attendance');
      } else if (event.target.name === 'guests') {
        validateField('guests');
      }
    });

    form.addEventListener('focusout', function (event) {
      var name = event.target.name;
      if ((name === 'name' || name === 'email') && event.target.value !== '') validateField(name);
    });

    form.addEventListener('input', function (event) {
      var name = event.target.name;
      if ((name === 'name' || name === 'email') && event.target.hasAttribute('aria-invalid')) validateField(name);
      if (!formError.hidden) formError.hidden = true;
    });

    function setSending(state) {
      sending = state;
      submitButton.disabled = state;
      submitButton.classList.toggle('is-loading', state);
      submitButton.setAttribute('aria-busy', String(state));
      submitLabel.textContent = state ? 'Sending\u2026' : defaultLabel;
    }

    function collectPayload() {
      var accepts = form.elements.attendance.value === 'accepts';
      return {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        attendance: form.elements.attendance.value,
        guests: accepts ? String(Math.min(maxGuests, Math.max(1, Number(guestsSelect.value) || 1))) : '0',
        dietary: accepts ? form.elements.dietary.value.trim() : '',
        message: form.elements.message.value.trim(),
        submittedAt: new Date().toISOString(),
        page: window.location.origin + window.location.pathname
      };
    }

    function showSuccess(payload, result) {
      var accepts = payload.attendance === 'accepts';
      var firstName = payload.name.split(/\s+/)[0];
      successPanel.querySelector('[data-success-title]').textContent = fillTokens(rsvp.successTitle, { name: firstName });
      successPanel.querySelector('[data-success-text]').textContent = accepts ? rsvp.successAccept : rsvp.successDecline;

      var demo = successPanel.querySelector('[data-success-demo]');
      demo.hidden = !result.demo;
      demo.textContent = result.demo ? rsvp.demoSuccess : '';

      var summary = successPanel.querySelector('[data-success-summary]');
      summary.textContent = '';
      function row(label, value) {
        if (!value) return;
        summary.appendChild(el('div', null, el('dt', { text: label }), el('dd', { text: value })));
      }
      row('Name', payload.name);
      row('Email', payload.email);
      row('Response', accepts ? 'Accepts with pleasure' : 'Declines with regret');
      if (accepts) row('Guests', payload.guests);
      row('Dietary requirements', payload.dietary);
      row('Message', payload.message);

      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
      successPanel.scrollIntoView({ block: 'center', behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;
      formError.hidden = true;

      var firstInvalid = validateAll();
      if (firstInvalid) { focusField(firstInvalid); return; }

      // Spam trap: bots fill the hidden field. Pretend success, send nothing.
      if (form.elements.website.value) {
        showSuccess(collectPayload(), { demo: false });
        return;
      }

      var payload = collectPayload();
      setSending(true);
      submitRsvp(payload).then(function (result) {
        setSending(false);
        showSuccess(payload, result);
      }).catch(function (error) {
        console.error('[Wedding template] RSVP submission failed:', error);
        setSending(false);
        formError.textContent = rsvp.errorMessage;
        formError.hidden = false;
        formError.focus();
      });
    });

    successPanel.querySelector('[data-rsvp-reset]').addEventListener('click', function () {
      form.reset();
      fieldNames.forEach(function (name) { setError(name, ''); });
      updateAttendanceView();
      successPanel.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ----------------------------------------------------------------------
     12. SCROLL REVEAL
     ---------------------------------------------------------------------- */
  function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    var showAll = function () { targets.forEach(function (node) { node.classList.add('is-visible'); }); };

    if (!('IntersectionObserver' in window) || prefersReducedMotion.matches) { showAll(); return; }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(function (node) { observer.observe(node); });

    // If the user switches on reduced motion later, reveal everything straight away.
    prefersReducedMotion.addEventListener('change', function (event) {
      if (event.matches) { showAll(); observer.disconnect(); }
    });
  }

  /* ----------------------------------------------------------------------
     13. START-UP
     ---------------------------------------------------------------------- */
  /**
   * Start-up happens in two steps so the first screen paints quickly:
   *   1. Theme, text bindings, banner, navigation, countdown (everything above the fold).
   *   2. Right after the first frame: build the long sections below and wire their interactions.
   */
  function start() {
    if (editing) {
      initCountdown();
      root.classList.add('js-ready');
      var buildEditing = function () {
        initNavigation();
        initLightbox();
        initFaq();
        initRsvp();
        initGifts();
        initParallax();
        initReveal();
        if (window.location.hash.length > 1) {
          var wanted = window.location.hash.slice(1);
          try { wanted = decodeURIComponent(wanted); } catch (error) { /* use the raw text */ }
          var target = document.getElementById(wanted);
          if (target) target.scrollIntoView();
        }
      };
      if ('requestAnimationFrame' in window) {
        window.requestAnimationFrame(function () { window.setTimeout(buildEditing, 0); });
      } else {
        buildEditing();
      }
      return;
    }

    applyTheme();
    validateConfig();
    applyBindings();

    initBanner();
    initCountdown();
    root.classList.add('js-ready');

    var buildRest = function () {
      renderStory();
      renderPeople();
      renderDetails();
      renderSchedule();
      renderGallery();
      renderFaq();
      renderTravel();
      renderFooter();

      initNavigation();
      initLightbox();
      initFaq();
      initRsvp();
      initGifts();
      initParallax();
      initReveal();

      // Honour a deep link such as #faq now that the page has its full height.
      if (window.location.hash.length > 1) {
        var wanted = window.location.hash.slice(1);
        // A hand-typed or damaged link such as "#%E0%A4%A" makes decodeURIComponent throw; ignore it.
        try { wanted = decodeURIComponent(wanted); } catch (error) { /* use the raw text */ }
        var target = document.getElementById(wanted);
        if (target) target.scrollIntoView();
      }
    };

    if ('requestAnimationFrame' in window) {
      window.requestAnimationFrame(function () { window.setTimeout(buildRest, 0); });
    } else {
      buildRest();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
