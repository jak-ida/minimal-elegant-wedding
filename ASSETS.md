# Asset inventory and licensing

Everything bundled in this template, where it came from, and what you need to do about it.
Keep this file up to date if you swap any asset.

> **Short version**
> - **Fonts:** open-licensed (SIL Open Font License 1.1). Fine to use on your wedding website and to keep in the
>   folder you upload. Keep `assets/fonts/OFL.txt` with them.
> - **Icons and ornaments:** drawn for this template and covered by `LICENSE.txt`.
> - **Pictures:** this download contains **no photographs**. The files in `assets/images/` are plain grey
>   placeholders. **You must supply every photograph yourself**, and you must have the right to use each one.
> - **Code:** no third-party libraries, scripts or services.

## 1. Fonts (self-hosted, no third-party requests)

| Family | Used for | Files | Source | Licence |
| --- | --- | --- | --- | --- |
| Cormorant Garamond (variable, roman and italic) | Headings, numerals, quotes | `assets/fonts/cormorantgaramond-*.woff2` | Google Fonts | SIL Open Font License 1.1 |
| DM Sans (variable) | Body text, buttons, forms | `assets/fonts/dmsans-*.woff2` | Google Fonts | SIL Open Font License 1.1 |
| Pinyon Script | Couple names | `assets/fonts/pinyonscript-regular.ttf` | `Pinyon_Script.zip` (SIL OFL) | SIL Open Font License 1.1 |

- Cormorant Garamond and DM Sans are the Latin and Latin Extended subsets served by Google Fonts; the letter shapes are
  unchanged. Pinyon Script is the Regular file from that zip. None of these three declares a Reserved Font Name.
- The full licence text and copyright lines are in `assets/fonts/OFL.txt`. The licence requires that notice to
  travel with the font files, so **keep that file in every copy you distribute or upload.**
- The OFL permits commercial use and bundling inside a product. It does not permit selling the fonts on their own.
- To use different fonts, see "Colours and typography" in `README.md`, and check the new fonts' licences.

## 2. Icons and ornaments

| Asset | Location | Origin | Licence |
| --- | --- | --- | --- |
| Botanical divider (leaf ornament) | inline SVG `<symbol id="ornament">` in `index.html` | Drawn for this template | Covered by `LICENSE.txt` |
| UI icons (close, arrows, plus, back-to-top) | inline SVG symbols in `index.html` | Drawn for this template (simple geometric strokes) | Covered by `LICENSE.txt` |
| Favicon placeholder | `assets/icons/favicon.svg` | Drawn for this template | Covered by `LICENSE.txt` |

No icon fonts or third-party icon packs are used.

## 3. Pictures

`assets/images/` holds **placeholder images**: a soft green, pink or ivory background, a thin gold frame, a small
line drawing of a picture, and the words "Your photo here" with the slot's name and pixel size. They were
generated for this template from plain colour and text. They show no people and contain no third-party material.

| Files | Slot |
| --- | --- |
| `hero-*.webp` | Hero (top of the page) |
| `story-*.webp` | Our story |
| `portrait-amara-*.webp`, `portrait-daniel-*.webp` | Couple introduction (portraits) |
| `gallery-1-*.webp` to `gallery-7-*.webp` | Gallery |
| `final-*.webp` | Closing invitation |
| `og-image.jpg` | Preview picture when your link is shared (1200 x 630) |

**What you must do:** replace every one of these with your own photographs, using the shapes and sizes in
`README.md` ("Replacing images"), and rewrite every picture description (`alt`) in `js/config.js` (they currently
say "Placeholder image"). Your own photographs, or photographs you have written permission to use, are the only
safe choice.

Be careful with photographs from "free" websites. Many licences forbid use on a site that is also a commercial
product, require credit, or exclude pictures of identifiable people. Photographs of other people (guests,
relatives, children) should only be published with their permission. If you create pictures with an AI image tool,
read that tool's current terms for your use, and remember the legal position of AI-generated images differs between
countries.

## 4. Text and design

- The sample wording (the names "Amara and Daniel", the venue "Willowbrook Gardens", the story, FAQ and schedule) was
  written for this template and is fictional. Any resemblance to a real couple or venue is a coincidence. Replace it
  all.
- The layout, styles and scripts are part of the template and covered by `LICENSE.txt`.

## 5. Third-party code and services

- **None at runtime.** No JavaScript libraries, no CDN scripts, no analytics, no tracking, no web fonts requested from other servers.
- External links appear only if you supply a URL (registry, honeymoon fund, hotels, map, social).
  The sample uses `example.com` (a domain reserved for documentation) and a generic Google Maps
  search link as placeholders. Replace them.
- Your RSVP service, if you add one, is a third party you choose; its terms and privacy rules apply to your guests' data.

## 6. Optional helper scripts in `tools/`

- `serve.ps1`: a tiny local preview server for Windows, written for this template. Uses only what ships with Windows.
- `optimise-images.py`: an optional helper that needs Python 3 and the Pillow library (HPND licence, installed by you with
  `pip install pillow`; not included in this download).
