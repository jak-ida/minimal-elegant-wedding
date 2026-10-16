# dev-tests (author only, never shipped to customers)

Automated browser checks used while building and packaging the template. Buyers do not need this folder and
`tools/make-zip.ps1` leaves it out (the ZIP is built from an allow-list, and `tools/verify-zip.ps1` fails the build if
anything from here appears in it).

## Setup

Requires Node.js 18+ and Google Chrome.

```bash
cd dev-tests
npm install            # puppeteer-core, axe-core, lighthouse (dev only)
```

Serve the **project folder** (any of these), default address `http://127.0.0.1:8123/index.html`:

```bash
python -m http.server 8123                    # plain, uncompressed
python dev-tests/serve-gzip.py 8126           # gzip + cache headers, closer to real hosting
```

## Run

```bash
# CHROME_PATH   if Chrome is not in the default Windows location
# BASE_URL      if you use another port, e.g. http://127.0.0.1:8126/index.html
# NODE_PATH     must include the node_modules folder that holds axe-core (qa-a.js reads axe from there)
node functional.js        # 92 checks: navigation, countdown, lightbox, FAQ, RSVP, a11y basics, widths
node qa-a.js              # assets, links, deep links, semantics, axe scans (10 states), text over photos,
                          # 29-width live-resize sweep, 200% font and text spacing, resize-with-state
node qa-b.js              # RSVP states and simulated endpoint, countdown (offsets, time zones, clock jumps,
                          # invalid dates), gallery and touch, keyboard walks, reduced motion, print
node qa-c.js              # missing files, restricted browser features, stress and hostile config, external
                          # links, print, forced colours, dark scheme, initial load
node zip-smoke.js         # load test of the BUILT ZIP using the shipped Windows server (see SELLER-GUIDE.md)
node shots.js 1440,390    # full-page screenshots into dev-tests/output/
node lightbox-outside.js  # lightbox click-outside behaviour
npx lighthouse http://127.0.0.1:8126/index.html --form-factor=mobile --view
```

Run the suites one after another, not at the same time: several of them measure timing.

`qa-helpers.js` is shared code.
Never toggle Puppeteer's `isMobile` on a page that is already open: it reloads the page and hides resize bugs.

What these tests do *not* do: test real RSVP services, real screen readers, Safari or Firefox, or physical phones.
Recorded results are in `RESULTS.md`.
