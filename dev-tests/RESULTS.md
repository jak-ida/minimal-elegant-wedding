# Recorded test results (author only, never shipped)

Last full run: Windows 11, Google Chrome (headless, driven by Puppeteer-core 24), axe-core 4.14, local server on
`127.0.0.1` (plain, uncompressed). Suites were run one after another. Nothing here was run in Safari, Firefox or a
real phone, with a real screen reader, or against a live RSVP service or web host.

| Suite | Result | What it covers |
| --- | --- | --- |
| `functional.js` | 92 / 92 | Page health, countdown, navigation, banner, FAQ, lightbox, RSVP (demo and simulated https endpoint), motion, no-JS, `file://`, keyboard focus, widths 320-1920 |
| `qa-a.js` | 84 / 84 | Assets and requests, links, deep links, semantics, axe scans of 10 page states (0 violations; colour contrast flagged "needs manual review" by axe on gradients and was measured separately), contrast of text on photographs from rendered pixels, 29-width live-resize sweep, 200% font size, WCAG text-spacing overrides, state across resizing |
| `qa-b.js` | 112 / 112 | RSVP validation and states, countdown (UTC offsets, time zones, clock jumps, invalid dates), gallery and lightbox, keyboard walks at several widths, reduced and normal motion, print without scrolling |
| `qa-c.js` | 64 / 64 | Missing config/images/fonts, restricted or missing browser features (storage, `IntersectionObserver`, `Intl`, `showModal`), stress and empty configurations, hostile strings, external links, print, forced colours, dark scheme, initial load |
| `zip-smoke.js` | 22 / 22 | The built ZIP extracted to a temp folder and served by the shipped `tools/serve.ps1` |

Total for the four browser suites: **352 checks, 352 passed** in the final run.

## Defects found and fixed during this QA pass

- A malformed URL hash (`#%E0%A4%A`) threw "URI malformed".
- At 200% browser font size, the countdown, RSVP header, footer and schedule overflowed sideways.
- Impossible dates such as `2027-02-31` or `25:00` were accepted; they are now rejected with a readable console message.
- A countdown with more than three digits of days overflowed its box.
- The countdown screen-reader summary said "1 days"; it now uses singular words and updates once a minute.
- Gallery, FAQ and schedule sections stayed on the page, with a menu link, when their lists were empty. The same applied to the "Where to stay" and milestone headings. They are now hidden when empty.
- A broken `Intl` implementation stopped the page from starting; date fallbacks now exist.
- Printing a page that had not been scrolled printed blank sections and pale-on-dark text; print styles now force dark text on white, show everything and open the FAQ.
- Windows high-contrast mode lost button and FAQ outlines.
- `//host` links were accepted as ordinary links; they are now refused.
- A line break in a heading ("we" / "say") was read as one word by text extraction; a space is now inserted before the break.
- A tall RSVP message box extends past the screen edge when focused; this is browser behaviour and is no longer flagged.

## Test-harness corrections (not product bugs)

Skip-link transition timing, `#top` expectations, hidden empty headings, `isMobile` reloads, forced-colours emulation,
expected "fewer than six gallery images" warning, hidden-element filters, and the Chrome lazy-load distance for the
story photo on phones.

## Measured, not asserted

Before any scrolling on a 390 px phone: 12 requests, about 499 KB (images 4, about 201 KB; fonts 3; scripts 3).
Lighthouse numbers from the build (mobile performance 98 with compressed delivery, accessibility 100, desktop 100 / 100 / 100 / 100) are from
an earlier build of the page and have **not** been repeated after the QA fixes. Performance depends strongly on the host.

## Known gaps

No real assistive technology. Chrome only. Device emulation only. Simulated RSVP endpoint. No live host.
Keyboard order in multi-column layouts (gallery and travel) follows source order, so 6 stops at 1280 px follow a lower item.
