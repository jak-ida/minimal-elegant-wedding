# Wedding Website Template: "Garden Editorial"

A single-page wedding website built with plain **HTML, CSS and vanilla JavaScript**.
No framework, no build step, no npm, no third-party scripts. Edit one file (`js/config.js`),
upload the folder to any static host, and you are online.

> **New here? Open `START-HERE.html` first.** It is a step-by-step installation guide written for
> people who have never built a website. This README is the detailed reference.

> **Important:** this is a *static* website. It cannot save RSVPs, send emails or run any
> server code by itself. Out of the box the RSVP form runs in **demo mode** and stores nothing.
> Read [Connecting a real RSVP service](#connecting-a-real-rsvp-service) before you send the
> link to guests.

---

## Contents

1. [Quick start](#quick-start)
2. [What is included](#what-is-included)
3. [Customising your website](#customising-your-website)
4. [Replacing images](#replacing-images)
5. [Colours and typography](#colours-and-typography)
6. [Date, time and time zone](#date-time-and-time-zone)
7. [Connecting a real RSVP service](#connecting-a-real-rsvp-service)
8. [Before you publish: what must be replaced](#before-you-publish-what-must-be-replaced)
9. [Hosting](#hosting)
10. [Removing or reordering sections](#removing-or-reordering-sections)
11. [Accessibility, performance and browser support](#accessibility-performance-and-browser-support)
12. [Known limitations](#known-limitations)
13. [Privacy and security notes](#privacy-and-security-notes)
14. [Testing](#testing)
15. [File map](#file-map)

---

## Quick start

1. **Unzip** the download (do not work from inside the ZIP).
2. **Preview it on your computer.** You do not need to install anything:
   - **Windows:** double-click `start-local-server.bat`. It uses Python 3 if you have it and a built-in
     Windows script if you do not.
   - **Mac:** first time only, in Terminal run `chmod +x start-local-server.command`, then double-click it
     (needs Python 3, which current macOS includes). **Linux:** run `sh start-local-server.command`.
   - **Any system, in a terminal opened in this folder:** `python -m http.server 8000`, then visit
     `http://localhost:8000`. (`npx serve .` also works if you have Node.js.)
   - **Visual Studio Code:** right-click `index.html` and choose *Open with Live Server*.
   - **Or just double-click `index.html`.** This was checked in Chrome only. Chrome's console may show two
     harmless "font ... blocked by CORS policy" lines because it refuses to *pre-load* fonts from a file on
     your disk; they disappear when the site is served over `http://` or `https://`. If anything looks off
     in another browser, use one of the server options above.
3. Open `js/config.js` in a plain text editor (Notepad, VS Code, TextEdit in plain-text mode; **not** Word),
   change the sample names, date and text, save, and refresh the browser.
4. Replace the grey placeholder pictures in `assets/images/` with your own photographs.
5. Connect an RSVP service (or leave the form in demo mode) and upload the folder. See
   [Connecting a real RSVP service](#connecting-a-real-rsvp-service) and [Hosting](#hosting).

The preview servers listen only on your own computer (`localhost`). They are for editing, not for
putting the site online.

---

## What is included

**Sections (all in one page):** announcement banner, sticky navigation with mobile menu, hero,
live countdown, our story with milestones, couple introductions, wedding details with directions
link, hour-by-hour schedule, photo gallery with lightbox, RSVP form, FAQ accordion, gift
information, travel and accommodation, final invitation, footer.

**Features**

- Everything editable from `js/config.js`: names, date, venue, story, bios, schedule, FAQ,
  gallery, links, colours, fonts, guest limit, footer and attribution.
- Live countdown (days, hours, minutes, seconds) with graceful past-date handling and a finished message.
- Accessible gallery lightbox: keyboard (arrows, Escape), focus trap and restore, swipe on touch,
  click-outside-to-close, background scroll lock.
- RSVP with validation, inline error messages, loading and success states, and a documented
  adapter with **Demo** and **Production** modes.
- Accessible FAQ accordion (buttons, `aria-expanded`, `aria-controls`, arrow-key navigation).
- Motion: hero entrance, fade-and-rise reveals, image reveal masks, staggered lists, hover zoom,
  one-time ornament drawing. Respects `prefers-reduced-motion`.
- Mobile-first responsive layout tested from 320 px to 1920 px.
- SEO and social tags (title, description, Open Graph, Twitter card, canonical placeholder).
- Self-hosted fonts and locally stored, responsive WebP images. No external requests.

---

## Customising your website

Open **`js/config.js`**. It is organised into numbered sections with comments and sample values.

| Section in `config.js` | What it controls |
| --- | --- |
| `couple` | Both names, optional monogram for the logo |
| `wedding` | Date and time, date language, 12h/24h, countdown messages |
| `banner` | Announcement text, on/off, dismiss button |
| `theme` | Colour overrides, font stacks |
| `hero` | Eyebrow, tagline, invitation line, location line, buttons, hero photo |
| `countdown` | Heading and labels |
| `story` | Heading, paragraphs, photo, milestone dates |
| `introductions` | The two profiles (set `enabled: false` to remove the section) |
| `details` | Venue, address, map link, ceremony, reception, dress code, parking (dress code and parking each have a short headline plus a longer note) |
| `schedule` | Timeline rows (add, remove, reorder) |
| `gallery` | Photos and descriptions |
| `rsvp` | Mode, endpoint, guest maximum, deadline, wording |
| `faq` | Questions and answers, contact address |
| `gifts` | Gift text, registry link, honeymoon fund link |
| `travel` | Travel notes, accommodation list, map link |
| `finale` | Closing heading, photo, button |
| `footer` | Hashtag, social links, attribution switch |

**Text tricks**

- `\n` inside a heading forces a line break: `"How it all\n*began*"`.
- Wrap a word in `*asterisks*` to make it italic and gold: `"one beautiful *beginning.*"`.
- In FAQ answers, `{deadline}` becomes the RSVP deadline date and `{contact}` becomes your contact
  address (as an email link if it is an email address).
- Leave any link as `""` to hide the button or link that uses it.
- Plain text only. HTML tags are shown as text, not interpreted. This is deliberate (it keeps the
  page safe).

**Things that are not in `config.js` (edit `index.html` once):** the search-engine and
social-sharing tags in `<head>` (search the file for `REPLACE`), the navigation labels, the RSVP
form field labels, and `<html lang="en">` if you translate the site.

---

## Replacing images

`assets/images/` contains **grey placeholder pictures** (each one has its slot name and pixel size printed
on it). Replace every one of them with your own photographs. They are WebP files in two or three sizes
each for fast mobile loading. The `alt` text in `config.js` for each photo currently reads "Placeholder
image" so you can search for it and be certain none is left.

### The simple way (same file names)

1. Prepare your photo at the same shape as the one you are replacing (see table).
2. Export it as WebP (or JPEG) at the sizes listed.
3. Save over the existing file names. Done: no code changes.

| Slot | File name pattern | Shape | Recommended widths | Notes |
| --- | --- | --- | --- | --- |
| Hero | `hero-480.webp`, `hero-640.webp`, `hero-864.webp` | portrait 3:4 | 480, 640, 1100+ | Keep faces in the upper-middle of the frame; it is cropped into an arch |
| Story | `story-480.webp`, `story-1152.webp` | landscape 4:3 | 480, 1200 | Cropped to 5:6 on desktop |
| Couple portraits | `portrait-amara-*.webp`, `portrait-daniel-*.webp` | portrait 3:4 | 480, 900 | Cropped into arches |
| Gallery | `gallery-1-*.webp` ... `gallery-7-*.webp` | any shape | 480 and 1280 to 1600 | Each keeps its own shape |
| Final invitation | `final-480.webp`, `final-1280.webp` | landscape 16:9 | 480, 1600 | Keep the subjects on the right half; text sits on the left |
| Social preview | `og-image.jpg` | 1200 x 630 | 1200 | Used when the link is shared |

### The flexible way (new file names)

In `config.js`, each photo is an object:

```js
{
  src:    "assets/images/my-photo-1200.webp",                  // main file (lightbox uses this)
  srcset: "assets/images/my-photo-480.webp 480w, assets/images/my-photo-1200.webp 1200w", // optional
  width:  1200,   // REAL pixel width of src
  height: 800,    // REAL pixel height of src
  alt:    "Describe the photo for people who cannot see it."
}
```

- **width and height** must match the real image so the browser can reserve space (no layout jump).
- **alt** is required. Describe what is in the photo in one sentence.
- **Hero photo:** it is also referenced in the `<head>` preload and the `<img>` in `index.html`
  so the browser loads it as early as possible. If you use new file names, update those two places
  too (search for `hero-864.webp`).
- **Add or remove gallery photos** by adding or removing objects in `gallery.images` (six or more
  looks best). The layout adapts automatically.

### Making smaller files

- Any image tool works (Squoosh at squoosh.app, Photoshop, Lightroom). Aim for WebP quality 75 to 82.
- If you have Python 3 with Pillow (`pip install pillow`), `python tools/optimise-images.py my-originals`
  creates a 480 px and a full-size WebP for every image in a folder.

---

## Colours and typography

### Colours

Defaults live as CSS variables at the top of `css/styles.css`:

```css
--color-ivory: #F8F5EF;    /* page background */
--color-forest: #34483B;   /* headings, buttons, dark sections */
--color-sage: #A6B29A;     /* soft tinted sections */
--color-rose: #D8B8B1;     /* gentle accents */
--color-charcoal: #33312E; /* body text */
--color-gold: #B49A69;     /* fine lines and ornaments */
--color-white: #FFFFFF;    /* form surfaces */
```

You can change them there, **or** in `js/config.js` under `theme.colors` (those override the CSS).
Tinted section backgrounds, the dark footer and the readable "dark gold" text colour are derived
automatically from these.

**Keep contrast in mind.** Body text and headings must stay dark on a light background. Gold
(`#B49A69`) is only 2.5:1 against ivory, so it is used for fine lines and ornaments. Two darker mixes
are derived from it: a deep one for small gold text, and a warmer one (about 3.9:1) used only for the
very large italic headings. If you pick a much lighter gold or sage, check your combinations
with a contrast checker (aim for at least 4.5:1 for small text and 3:1 for large headings).

### Fonts

The demo bundles **Cormorant Garamond** (headings) and **DM Sans** (body) as self-hosted files.
To change them:

1. Download your fonts as `.woff2` files (from Google Fonts, Fontsource or your foundry; check licences).
2. Put them in `assets/fonts/`.
3. Add `@font-face` rules to the top of `css/styles.css` (copy the existing ones as a pattern) with `font-display: swap`.
4. In `config.js` set `theme.fonts.heading` and `theme.fonts.body`, for example
   `"'Playfair Display', Georgia, serif"`.
5. Update the two `<link rel="preload" ... as="font">` lines in `index.html`, or delete them.

---

## Date, time and time zone

Set `wedding.dateTime` in `config.js`:

| You type | Meaning |
| --- | --- |
| `"2027-06-19T14:30:00"` | 19 June 2027 at 14:30 **in each visitor's own local time zone.** Simple. A guest flying in from another zone sees the countdown end at 14:30 on their own clock. |
| `"2027-06-19T14:30:00+02:00"` | An exact moment (here UTC+2). The countdown ends at the same instant for everyone. **Recommended when many guests are in other time zones.** Remember daylight-saving: summer in much of Europe is `+02:00`, winter `+01:00`. |

The **date and ceremony time shown on the page are always the ones you typed**; they never shift
with the visitor's time zone. Only the countdown uses the time-zone logic above.

If the value is not a real date or time (month 13, 30 February, 25:00), the page does not guess: the
date and countdown are left out and the browser console (F12) explains the problem.

If the date has passed, the countdown is replaced by a thank-you message
(`wedding.countdownPastMessage`). On the wedding day itself (the first 24 hours after the target)
it shows `wedding.countdownFinishedMessage`.

---

## Connecting a real RSVP service

### How the RSVP form works

`rsvp.mode` in `config.js` has two settings:

| Mode | Behaviour |
| --- | --- |
| `"demo"` (default) | Validates the form and shows a success screen that says plainly that **nothing was stored or sent**. On `localhost` and local files a notice above the form says the same. |
| `"production"` | After validation, sends the response with `fetch()` to `rsvp.endpoint`. Handles loading, server errors, network failure, timeouts (15 s by default) and success. |

If `mode` is `"production"` but the endpoint is empty or **not `https://`**, the form refuses to
send and falls back to demo mode (with a console warning), so a typing mistake cannot silently
lose or leak responses.

### What gets sent

By default the form posts these fields as form data (`rsvp.format: "form"`) or JSON
(`rsvp.format: "json"`):

```json
{
  "name": "Zoë Thompson",
  "email": "zoe@example.org",
  "attendance": "accepts",        // or "declines"
  "guests": "3",                  // "0" when declining
  "dietary": "Vegetarian",
  "message": "Can't wait!",
  "submittedAt": "2027-04-02T09:15:00.000Z",
  "page": "https://your-domain.com/"
}
```

A hidden spam-trap field named `website` is checked in the browser; real guests never see it.

### Option A: a form service (easiest, no code)

Services such as **Formspree**, **Getform**, **Basin** or **FormSubmit** give you an HTTPS address
that forwards submissions to your email and/or a dashboard.

1. Create a form on the service and copy its endpoint URL.
2. In `config.js`:

   ```js
   rsvp: {
     mode: "production",
     endpoint: "https://formspree.io/f/your-form-id",   // your own endpoint
     method: "POST",
     format: "form",   // try "json" if your service prefers it
     // ...
   }
   ```
3. Add your website address to the service's allowed domains if it has that setting.
4. **Send a real test submission** and confirm you receive it.

### Option B: your own serverless function or webhook

Any HTTPS URL that accepts a POST works: Cloudflare Workers, Netlify or Vercel Functions, AWS
Lambda, Make or Zapier webhooks, Google Apps Script web apps. Your endpoint should:

- Accept the fields above.
- Return a 2xx status on success (and, if it returns JSON, not include `"ok": false`, `"success": false` or an `"error"` key).
- Send CORS headers allowing your website's origin (`Access-Control-Allow-Origin`), plus
  `Access-Control-Allow-Headers: Content-Type` if you use `format: "json"`.
- Keep any API keys or secrets **on the server**, never in this template.

### Never do this

- **Do not put private API keys, passwords or tokens in `config.js` or any frontend file.** Anyone can read them.
- Do not use an endpoint you do not control or trust with your guests' personal data.

### Test before going live

> **Note:** the adapter was tested here against a *simulated* HTTPS endpoint (success, server
> error, network failure and error-in-JSON cases). It has **not** been tested against Formspree,
> Google Apps Script or any other live service. Always run your own end-to-end test.

Checklist: submit an accept response, a decline response, a response with an apostrophe or accent
in the name, and test with your phone on mobile data. Confirm you receive each one. Then also
break it on purpose (turn off Wi-Fi) and confirm the guest sees the friendly error message.

---

## Before you publish: what must be replaced

Everything in the download is **sample content or a placeholder**. Tick these off:

- [ ] `couple.partnerOne` and `couple.partnerTwo`
- [ ] `wedding.dateTime` (and decide on a time-zone offset)
- [ ] `hero.*` text and location line
- [ ] `story.*` paragraphs and milestone dates
- [ ] `introductions.people` (bios, quotes, details), or set `enabled: false`
- [ ] `details.*`: venue name, address, **map link**, ceremony and reception text, dress code, parking
- [ ] `schedule.events`
- [ ] **All photographs** (replace every grey placeholder in `assets/images/`) and every `alt` text (search `config.js` for "Placeholder image")
- [ ] `rsvp.mode`, `rsvp.endpoint`, `rsvp.deadline`, `rsvp.maxGuests`, privacy note
- [ ] `faq.contact` (currently `hello@example.com`) and all FAQ answers
- [ ] `gifts.registryUrl` and `gifts.fundUrl` (currently `example.com` placeholders), or set to `""`
- [ ] `travel.*`: notes and the **three sample accommodations** (labelled "Sample listing"; remove `placeholder: true` when real)
- [ ] `footer.hashtag` and `footer.socials`
- [ ] `<head>` of `index.html`: title, description, canonical URL, Open Graph and Twitter tags, social image (search for `REPLACE`)
- [ ] `assets/icons/favicon.svg` (your initials)
- [ ] `footer.attributionText` and `footer.showAttribution` (see `LICENSE.txt`)
- [ ] Add a privacy statement if your local law requires one for collecting names and emails

---

## Hosting

This is a folder of static files. Upload the **whole folder contents** (keep the folder structure).

| Host | How |
| --- | --- |
| **Netlify** | Drag the folder onto app.netlify.com/drop. |
| **Cloudflare Pages** | Create a project, upload the folder (direct upload). |
| **GitHub Pages** | Put the files in a repository, enable Pages in Settings. |
| **Traditional hosting (cPanel, Hostinger, etc.)** | Upload everything to `public_html` with the file manager or FTP. |
| **Vercel** | Import the folder; no build command needed. |

After uploading:

1. Update the canonical, `og:url`, `og:image` and `twitter:image` tags in `index.html` to your real
   address. The social image URL must be absolute (starts with `https://`).
2. Make sure your host serves the site over **HTTPS** (all the above do).
3. Make sure text compression (gzip or Brotli) is on. Most hosts do this automatically.
4. Paste your link into a social network's link debugger (or just send it to yourself) to check the preview.
5. Open the site on a real phone.

---

## Removing or reordering sections

- **Couple introduction:** set `introductions.enabled: false`, or delete the block between
  `<!-- E. COUPLE` and `<!-- END COUPLE -->` in `index.html`.
- **Any other section:** delete its `<section>` block in `index.html` and its link in the navigation if it has one.
  The scripts skip sections that are missing (if you remove a section, also remove its `config.js` block or leave it; it is ignored).
- **Reorder:** move the `<section>` blocks around inside `<main>`. Sections are independent.
- **Navigation:** the menu is plain HTML in `index.html`. Every link points to a real section `id`.

---

## Accessibility, performance and browser support

**Accessibility (built in):** semantic landmarks, one `h1`, ordered headings, skip link, visible
focus rings, labelled form fields with inline errors that use icon + text (not colour alone),
accessible menu (`aria-expanded`, `aria-controls`, Escape), accordion and modal dialog patterns,
descriptive `alt` text, countdown that does not announce every second, reduced-motion support.
This is a *practical* WCAG 2.2 AA effort. It has been checked with automated tests and
Lighthouse, but **has not been audited by a person using a screen reader** on every browser.

**Performance:** WebP images in responsive sizes, lazy loading below the fold, hero image preloaded,
dimensions reserved, no JavaScript libraries, no third-party requests, self-hosted fonts.
Lighthouse results from the build are summarised in `TESTING.md`.

**Browser support:** designed for current versions of Chrome, Edge, Firefox and Safari (roughly 2023
onward); it uses modern CSS (`color-mix`, `clip-path`, `<dialog>`, CSS grid) and no libraries. **Only
Chrome has actually been tested.** Safari, Firefox and Edge, and real phones and tablets, have not, so
please check them yourself before you publish (see `TESTING.md`). Older browsers may lose tinted
backgrounds or some animation, and Internet Explorer is not supported.

---

## Known limitations

- **No backend.** RSVPs are not stored unless you connect an endpoint. There is no guest-list
  management, no invitation codes, no email confirmations.
- **Content is rendered by JavaScript** from `config.js`. If a visitor has JavaScript turned off,
  they see the hero photo, navigation and a notice asking them to enable it, not the wording.
  (This was a deliberate trade-off to keep one editable source of truth.)
- **Single language.** Field labels and a few interface strings are in English inside
  `index.html`/`main.js`. Dates follow `wedding.locale`. Right-to-left languages are not styled.
- **No photographs are included.** The pictures supplied are grey placeholders; you provide every photograph. See `ASSETS.md`.
- **The gallery keeps each photo's own shape using CSS columns.** Photos run down each column, so the order a keyboard or screen-reader user moves through them can differ from the left-to-right order a sighted visitor sees. Every photo is still reachable and labelled.
- **Social-share tags are static** in `index.html` and must be edited by hand (social networks do not run JavaScript).
- **The countdown relies on the visitor's device clock.** If their clock is wrong, so is the countdown.
- **Autumn/spring clock changes:** if you use a fixed offset (`+02:00`), choose the one in force on your wedding date.
- **No dark mode.** The page is always light, even if the visitor's device is set to dark.
- Live RSVP services have **not** been tested; see the RSVP section.

---

## Privacy and security notes

- No analytics, cookies or trackers are included. The only browser storage used is a
  `sessionStorage` flag that remembers if the visitor closed the announcement banner (cleared when the tab closes).
- RSVP data (names, emails, dietary needs, messages) is personal data. If you collect it, you are
  responsible for choosing a trustworthy service, telling guests how it is used (there is a
  one-line privacy note you can edit), keeping it secure and deleting it when no longer needed.
- All content from `config.js` is inserted as plain text, never as HTML, so a typo or pasted text
  cannot inject code. Link URLs are limited to `https`, `http`, `mailto`, `tel` and relative or `#` links.
- External links open with `rel="noopener noreferrer"`.
- Never place secrets in any file in this folder.

---

## Testing

`TESTING.md` contains a checklist to run on your finished website and an honest summary of what was
and was not checked on the template itself.

---

## File map

```
wedding-template/
├── index.html              Page structure and SEO tags
├── START-HERE.html         Step-by-step installation guide (open this first)
├── README.md               This reference guide
├── LICENSE.txt             What you may and may not do with the template
├── ASSETS.md               Fonts, icons, images and their licences
├── TESTING.md              Pre-launch checklist and summary of what was tested
├── start-local-server.bat      Windows: double-click to preview the site (no install needed)
├── start-local-server.command  Mac / Linux preview launcher (needs Python 3)
├── css/
│   └── styles.css          All styles (fonts, tokens, sections, motion)
├── js/
│   ├── config.js           <-- YOUR CONTENT AND SETTINGS (edit this)
│   ├── main.js             Rendering and interactions (no need to edit)
│   └── boot.js             Tiny script that enables safe animations
├── assets/
│   ├── images/             Grey placeholders to replace with your photographs (+ og-image.jpg)
│   ├── fonts/              Self-hosted fonts + OFL.txt licence
│   └── icons/              Favicon placeholder
├── tools/
│   ├── serve.ps1           Built-in Windows preview server used by start-local-server.bat
│   └── optimise-images.py  Optional image helper (needs Python 3 + Pillow)
```
