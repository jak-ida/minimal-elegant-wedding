# Testing

Two parts: a **checklist you run before launching your own site**, and an **honest record of what was
and was not tested** on this template during the build.

---

## 1. Pre-launch checklist (do this with your own content)

Open the finished site on a real phone and on a laptop, then tick each line.

### Content
- [ ] Names, date, time and time zone are correct in `js/config.js` (`wedding.dateTime`).
- [ ] The countdown shows the right number of days. If guests are in a different time zone, you typed an offset such as `+01:00`.
- [ ] Venue name, address and **Get Directions** link are correct. The map link opens the right place.
- [ ] Every schedule time is correct and in the right order.
- [ ] No sample text remains: search `config.js` for `example.com`, `Willowbrook`, `Amara`, `Daniel`, `Your Studio Name`, `REPLACE`.
- [ ] Gift links either go to your real pages or are removed. No placeholder `example.com` links remain.
- [ ] Hotel names and booking links are real, or the Travel section is removed.
- [ ] You own or are licensed to use every photograph, and photos of other people have their permission.
- [ ] Spelling and punctuation checked by someone else.

### RSVP
- [ ] `rsvp.mode` is `"production"` and `rsvp.endpoint` is your real `https://` address.
- [ ] You submitted a **real test RSVP** from the live site and saw it arrive where you expected.
- [ ] You also tested: a decline, a long message, and a name with accents or apostrophes.
- [ ] You tested the failure path (turn Wi-Fi off, submit): the guest sees a clear error and the form keeps their answers.
- [ ] The privacy note under the form is accurate for the service you chose.
- [ ] The "demo mode" notice is gone.

### Devices and browsers
- [ ] An iPhone (Safari) and an Android phone (Chrome): scroll the whole page, open the menu, open the gallery, submit the form.
- [ ] Desktop Chrome, Safari or Edge, and Firefox.
- [ ] Rotate a phone to landscape: nothing is cut off.
- [ ] Zoom the browser to 200%: all text is still readable and nothing overlaps.

### Accessibility (do at least the first three)
- [ ] Tab through the whole page using only the keyboard. You can always see where focus is, and you never get stuck.
- [ ] Open the photo viewer with Enter, move with the arrow keys, close with Escape. Focus returns to the photo you opened.
- [ ] Submit the RSVP form empty. Errors are shown in words, next to each field.
- [ ] Turn on your phone's or computer's screen reader (VoiceOver, TalkBack or NVDA) and listen to the first screen, the menu, and the form.
- [ ] Turn on "Reduce motion" in your system settings and reload: animations calm down and nothing is missing.

### Before you publish
- [ ] Replace `https://www.your-domain.com/` in `index.html` (canonical link and social-share tags) with your real address.
- [ ] Replace `assets/icons/favicon.svg` with your own icon.
- [ ] Paste your site address into a link-preview checker (or send it to yourself in a chat app) and check the share image and title.
- [ ] Run Lighthouse in Chrome DevTools on the live site (mobile and desktop) and read any warnings.
- [ ] Load the site on slow mobile data and make sure it still feels quick.

---

## 2. What was and was not tested before this template was packaged

Plain statement, so you know what you are buying and what you still need to check yourself.

### Checked by the seller (automated, desktop Google Chrome, local web server)

- Page loads without console errors; images load and have alternative text; headings are in order; internal links land on a real section.
- Countdown: ticks, shows the right numbers, reacts correctly to a past date, an invalid date and a very large number of days.
- Navigation, the mobile menu, the FAQ, the photo viewer (mouse and keyboard) and the RSVP form (empty, invalid and valid input).
- Responsive layout from 320 px to 1920 px, and at 200% text size: no sideways scrolling.
- Keyboard: every control can be reached with Tab, focus is always visible, focus does not get trapped.
- "Reduce motion" setting, print preview, Windows high-contrast mode, and a missing or broken `config.js`.
- Unusual content: very long names, many or few schedule items, photos, FAQ entries, empty sections.
- Hostile text in `config.js` is displayed as plain text and cannot run as code.
- The packaged ZIP: every required file is present, no development-only or unlicensed file is inside, and the extracted site loads and passes a smoke test through the included local server.

### NOT tested - please do these yourself

- **Real screen readers** (VoiceOver, TalkBack, NVDA, JAWS). Automated accessibility checks pass, but that is not user testing.
- **Browsers other than Chrome.** Safari (macOS and iOS), Firefox and Edge were not run.
- **Real phones and tablets.** Phone sizes were checked with Chrome's device emulation only.
- **A live RSVP service.** The production setting was tested against a simulated endpoint. Nothing was sent to a real service. Test yours (see README).
- **A live web host.** Not deployed to any host. Compression and caching depend on your host.
- Very old browsers (for example Internet Explorer) are not supported.

### Known limitations

- **The words on the page are written by JavaScript from `config.js`.** With JavaScript switched off, visitors see the photo, the layout and a short notice, but not the wording. That is the price of editing everything in one file.
- **The RSVP form cannot store anything on its own.** A static website has no place to keep answers. In the default "demo" mode the form only shows a message that nothing was sent. To collect real answers you must connect a form service or your own server (see README).
- **Opening `index.html` by double-click** works, but Chrome prints two harmless font-preload messages in its console. A local server (see START-HERE.html) avoids them.
- **Keyboard order in multi-column sections** follows the source order, so in a few places Tab moves down a column before moving across.
- **The pictures in this package are placeholders.** Replace them with your own photographs. See `ASSETS.md`.
