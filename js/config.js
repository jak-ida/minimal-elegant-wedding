/* ==========================================================================
   WEDDING TEMPLATE — CONFIGURATION
   ==========================================================================
   EDITING MODE: the words on the page are in index.html for now.
   This file is used again when the site is converted back before publishing.

   This is the ONLY file most buyers need to edit once that setup returns.

   HOW TO EDIT
   - Change the text between the quotation marks ("like this").
   - Keep the commas and quotation marks exactly as they are.
   - Use \n inside a heading to force a line break.
   - Wrap a word in *asterisks* inside a heading to make it italic.
   - Leave a link as "" (empty) to hide the button that uses it.
   - Save the file and refresh the page in your browser.

   SAMPLE CONTENT
   - Everything below is SAMPLE content (fictional couple, fictional venue,
     example.com links). Replace every value before publishing.
   - A checklist of what to replace is in README.md ("Before you publish").

   NOTE FOR SEARCH & SOCIAL SHARING
   - Link-preview tags (title, description, social image, canonical URL) live in
     the <head> of index.html because social networks do not run JavaScript.
     Update those too (search index.html for "REPLACE").
   ========================================================================== */

window.WEDDING_CONFIG = {

  /* ------------------------------------------------------------------------
     1. COUPLE
     ------------------------------------------------------------------------ */
  couple: {
    partnerOne: "Amara",
    partnerTwo: "Daniel",
    // Shown in the navigation logo. Leave "" to build it from the first letters.
    monogram: "",
    // Used for the browser tab title and accessibility labels.
    pageTitleSuffix: "Wedding Celebration"
  },

  /* ------------------------------------------------------------------------
     2. DATE, TIME AND TIME ZONE
     ------------------------------------------------------------------------
     dateTime format:  YYYY-MM-DDTHH:MM:SS
       "2027-06-19T14:30:00"        -> 19 June 2027, 14:30 in the VISITOR'S local
                                       time zone (simple; a guest in another
                                       time zone sees the countdown end at
                                       14:30 on THEIR clock).
       "2027-06-19T14:30:00+02:00"  -> an exact moment in time (UTC offset of the
                                       venue). The countdown then ends at the same
                                       instant for everyone. Use this if many
                                       guests travel from other time zones.

     The date and ceremony time displayed on the page are always the values you
     type here (they never shift with the visitor's time zone).
     ------------------------------------------------------------------------ */
  wedding: {
    dateTime: "2027-06-19T14:30:00",
    // Language used to write the date, e.g. "en-GB" (19 June 2027), "en-US"
    // (June 19, 2027), "fr-FR", "de-DE", "es-ES", "pt-BR".
    locale: "en-GB",
    // "24h" shows 14:30, "12h" shows 2:30 PM.
    timeFormat: "24h",
    countdownFinishedMessage: "Today is the day. We are married.",
    countdownPastMessage: "We said \"I do\" on {date}. Thank you for celebrating with us."
  },


  /* ------------------------------------------------------------------------
     4. THEME: COLOURS AND TYPOGRAPHY
     ------------------------------------------------------------------------
     Colours are optional overrides. Leave a value as "" to keep the default
     from css/styles.css. Keep strong contrast between "forest" (text) and
     "ivory" (background).
     ------------------------------------------------------------------------ */
  theme: {
    colors: {
      ivory:    "",   // default #F8F5EF  main page background
      forest:   "",   // default #34483B  headings, buttons, dark sections
      sage:     "",   // default #A6B29A  soft accents and tinted sections
      rose:     "",   // default #D8B8B1  gentle accents
      charcoal: "",   // default #33312E  body text
      gold:     "",   // default #B49A69  fine lines and ornaments
      white:    ""    // default #FFFFFF  form and paper surfaces
    },
    // Font stacks. The demo ships Cormorant Garamond + DM Sans (self-hosted in
    // assets/fonts). To use other fonts, add their files/@font-face to
    // the top of css/styles.css (copy an existing @font-face block), then set the name here. Leave "" for the defaults.
    fonts: {
      heading: "",    // e.g. "'Playfair Display', Georgia, serif"
      body: ""        // e.g. "'Inter', system-ui, sans-serif"
    }
  },

  /* ------------------------------------------------------------------------
     5. HERO
     ------------------------------------------------------------------------
     Photo tip: the hero photo is also referenced in index.html so the browser
     can load it early. The simplest way to change it is to replace the files
     assets/images/hero-480.webp and hero-864.webp with your own photos (same
     file names). See README.md > "Replacing images".
     ------------------------------------------------------------------------ */
  hero: {
    eyebrow: "Together with our families",
    // Not shown on the page. The original wording is in taglineStash, just below.
    tagline: "",
    invitation: "invite you to celebrate our wedding.",
    locationLine: "Willowbrook Gardens, Meadowvale",
    primaryButton: "Discover Our Story",
    secondaryButton: "RSVP",
    // Original hero line, kept so it can be put back. To show it again: copy this into tagline
    // and uncomment the hero__tagline paragraph in index.html.
    taglineStash: "Two hearts,\none beautiful *beginning.*",
    image: {
      src: "assets/images/hero-864.webp",
      srcset: "assets/images/hero-480.webp 480w, assets/images/hero-640.webp 640w, assets/images/hero-864.webp 864w",
      width: 864,
      height: 1152,
      alt: "Amara and Daniel laughing together among garden roses at golden hour: Amara in an ivory gown and veil, Daniel in a forest-green suit."
    }
  },

  /* ------------------------------------------------------------------------
     5b. COUNTDOWN (counts down to wedding.dateTime)
     ------------------------------------------------------------------------ */
  countdown: {
    eyebrow: "Counting down",
    heading: "Until we\nsay *I do*",
    labels: { days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds" },
    // Used by screen readers when a number is exactly 1 ("1 day"). Translate these together with the labels above.
    labelsSingular: { days: "Day", hours: "Hour", minutes: "Minute" },
    // Sentence read to screen-reader users (updated once a minute). {days} {hours} {minutes} are filled in.
    summary: "{days}, {hours} and {minutes} until the wedding."
  },

  /* ------------------------------------------------------------------------
     6. OUR STORY
     ------------------------------------------------------------------------ */
  story: {
    eyebrow: "Our story",
    heading: "How it all\n*began*",
    paragraphs: [
      "We met on a rainy Tuesday in September, sharing the last dry seat on a crowded bus. Amara was carrying an alarming amount of paperwork and Daniel was carrying an alarming amount of tomatoes. Neither of us has ever managed to explain the tomatoes.",
      "What began as a conversation about nothing in particular became long walks, longer dinners and a quiet certainty that home is a person, not a place.",
      "On an evening last spring, under the pear trees in the garden where we will soon be married, Daniel asked a question and Amara said yes before he had finished asking it."
    ],
    image: {
      src: "assets/images/story-1152.webp",
      srcset: "assets/images/story-480.webp 480w, assets/images/story-1152.webp 1152w",
      width: 1152,
      height: 864,
      alt: "Amara and Daniel walking hand in hand along a sunlit cobbled lane lined with climbing roses, Amara laughing over her shoulder."
    },
    milestonesHeading: "A few dates we hold dear",
    milestones: [
      { date: "September 2019", title: "We meet",       text: "A crowded bus, a rainy Tuesday and a bag of tomatoes." },
      { date: "February 2020",  title: "Our first date", text: "A tiny restaurant with six tables and one very patient waiter." },
      { date: "April 2026",     title: "The proposal",   text: "Under the pear trees, with the whole evening still ahead of us." }
    ]
  },

  /* ------------------------------------------------------------------------
     7. COUPLE INTRODUCTION
     ------------------------------------------------------------------------
     Set enabled to false to remove this whole section (and its menu mentions).
     ------------------------------------------------------------------------ */
  introductions: {
    enabled: true,
    eyebrow: "The couple",
    heading: "Meet the\n*two of us*",
    people: [
      {
        name: "Amara",
        role: "The bride",
        bio: "Amara is an architect who sketches on napkins, reads the last page of a book first and believes most problems can be solved with a long walk and a good playlist.",
        quote: "Home is wherever Daniel is humming.",
        detail: "Favourite thing: Sunday markets",
        image: {
          src: "assets/images/portrait-amara-864.webp",
          srcset: "assets/images/portrait-amara-480.webp 480w, assets/images/portrait-amara-864.webp 864w",
          width: 864,
          height: 1152,
          alt: "Portrait of Amara smiling, with natural curls, a sprig of white flowers in her hair and an ivory linen dress."
        }
      },
      {
        name: "Daniel",
        role: "The groom",
        bio: "Daniel teaches music at a secondary school, bakes sourdough that is better than it has any right to be, and has strong opinions about the correct way to load a dishwasher.",
        quote: "I knew when she laughed at my worst joke twice.",
        detail: "Favourite thing: Early-morning bike rides",
        image: {
          src: "assets/images/portrait-daniel-864.webp",
          srcset: "assets/images/portrait-daniel-480.webp 480w, assets/images/portrait-daniel-864.webp 864w",
          width: 864,
          height: 1152,
          alt: "Portrait of Daniel with a gentle smile, wearing a forest-green jacket over a white shirt, standing among white roses."
        }
      }
    ]
  },

  /* ------------------------------------------------------------------------
     8. WEDDING DETAILS
     ------------------------------------------------------------------------
     The date and ceremony time come from wedding.dateTime above.
     ------------------------------------------------------------------------ */
  details: {
    eyebrow: "The day",
    heading: "Wedding\n*details*",
    intro: "We would be honoured to have you with us. Here is everything you need to know for the day.",
    // Small headings used in the list (translate or reword as you like).
    labels: {
      date: "Date",
      ceremony: "Ceremony",
      venue: "Venue",
      reception: "Reception",
      dressCode: "Dress code",
      parking: "Parking"
    },
    venueName: "Willowbrook Gardens",
    // One line per array item.
    venueAddress: ["12 Orchard Lane", "Meadowvale", "MV1 2AB"],
    // "Get Directions" link. Easiest: open your venue in Google Maps (or any map
    // service), click Share, and paste the link here.
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Willowbrook+Gardens+12+Orchard+Lane+Meadowvale",
    directionsLabel: "Get Directions",
    ceremony: "The ceremony begins on the Orchard Lawn. Please take your seats by 14:15.",
    reception: "Drinks and canapés in the Glasshouse from 17:00, followed by dinner, speeches and dancing until late.",
    receptionVenue: "The Glasshouse, Willowbrook Gardens",
    // Each of these two has a short headline (shown in the display font) and a longer note.
    // Leave a headline as "" to show only the note.
    dressCodeSummary: "Garden formal",
    dressCode: "Soft pastels and greens are lovely; please leave white and ivory to the bride. The ceremony is on grass, so flats or block heels are kindest.",
    // Set parking to "" to hide the parking row.
    parkingSummary: "Free on-site parking",
    parking: "Please arrive early and share a car where you can."
  },

  /* ------------------------------------------------------------------------
     9. WEDDING SCHEDULE (add, remove or reorder rows freely)
     ------------------------------------------------------------------------ */
  schedule: {
    eyebrow: "The programme",
    heading: "The day,\n*hour by hour*",
    events: [
      { time: "14:00", title: "Guest arrival",           text: "Find a seat, say hello and collect an order of service." },
      { time: "14:30", title: "Wedding ceremony",        text: "Amara and Daniel exchange vows on the Orchard Lawn." },
      { time: "15:30", title: "Photographs and refreshments", text: "Lemonade, canapés and group photographs in the gardens." },
      { time: "17:00", title: "Reception",               text: "Join us in the Glasshouse for drinks and music." },
      { time: "19:00", title: "Dinner and speeches",     text: "A shared feast, a few heartfelt words and a toast." },
      { time: "21:00", title: "Dancing",                 text: "The first dance, then the floor is yours." }
    ]
  },

  /* ------------------------------------------------------------------------
     10. PHOTO GALLERY (at least six images recommended)
     ------------------------------------------------------------------------
     For each photo:
       src     main file (used in the lightbox)
       srcset  optional list of smaller versions: "small.webp 480w, big.webp 1152w"
       width / height  the REAL pixel size of src (prevents layout shift and
                       keeps each photo's own shape)
       alt     describe the photo for people who cannot see it
     ------------------------------------------------------------------------ */
  gallery: {
    eyebrow: "Gallery",
    heading: "Moments\n*we love*",
    intro: "A few frames from our engagement season and the places we dream about. Sample images; replace with your own.",
    images: [
      {
        src: "assets/images/gallery-1-864.webp",
        srcset: "assets/images/gallery-1-480.webp 480w, assets/images/gallery-1-864.webp 864w",
        width: 864, height: 1152,
        alt: "The couple walking hand in hand down a garden aisle as guests smile and rose petals drift through the air."
      },
      {
        src: "assets/images/gallery-2-1152.webp",
        srcset: "assets/images/gallery-2-480.webp 480w, assets/images/gallery-2-1152.webp 1152w",
        width: 1152, height: 864,
        alt: "A loose bridal bouquet of white garden roses, dusty-rose ranunculus, eucalyptus and baby's breath tied with an ivory ribbon."
      },
      {
        src: "assets/images/gallery-3-1024.webp",
        srcset: "assets/images/gallery-3-480.webp 480w, assets/images/gallery-3-1024.webp 1024w",
        width: 1024, height: 1024,
        alt: "Two gold wedding bands resting on folded ivory paper among flower petals and an olive sprig."
      },
      {
        src: "assets/images/gallery-5-864.webp",
        srcset: "assets/images/gallery-5-480.webp 480w, assets/images/gallery-5-864.webp 864w",
        width: 864, height: 1152,
        alt: "The groom twirling his laughing bride on a garden terrace under strings of warm lights at dusk."
      },
      {
        src: "assets/images/gallery-4-1280.webp",
        srcset: "assets/images/gallery-4-480.webp 480w, assets/images/gallery-4-1280.webp 1280w",
        width: 1280, height: 720,
        alt: "A round arch of white roses and greenery on a lawn beside a stone manor house, with rows of wooden chairs on either side."
      },
      {
        src: "assets/images/gallery-6-1152.webp",
        srcset: "assets/images/gallery-6-480.webp 480w, assets/images/gallery-6-1152.webp 1152w",
        width: 1152, height: 864,
        alt: "A long garden dinner table with linen, ceramic plates, brass candlesticks and arrangements of white flowers."
      },
      {
        src: "assets/images/gallery-7-1024.webp",
        srcset: "assets/images/gallery-7-480.webp 480w, assets/images/gallery-7-1024.webp 1024w",
        width: 1024, height: 1024,
        alt: "Close-up of the couple's clasped hands, her ivory sleeve beside his forest-green suit cuff."
      }
    ]
  },

  /* ------------------------------------------------------------------------
     11. RSVP
     ------------------------------------------------------------------------
     IMPORTANT: this template is a static website. It cannot save responses by
     itself. Choose a mode:

       mode: "demo"        Validates the form and shows a clearly labelled
                           demonstration. NOTHING is stored or sent.
       mode: "production"  Sends the response with fetch() to YOUR https endpoint
                           (a form service, serverless function, etc.).

     Never put private API keys or secrets in this file: everything here is
     visible to anyone who views your website. See README.md > "Connecting a
     real RSVP service".
     ------------------------------------------------------------------------ */
  rsvp: {
    eyebrow: "RSVP",
    heading: "Will you\n*join us?*",
    message: "Your presence would mean the world to us. Please let us know whether you can celebrate with us.",
    // Deadline shown to guests (also used in the FAQ if you reference {deadline}).
    deadline: "2027-05-01",

    mode: "demo",                 // "demo" or "production"
    endpoint: "",                 // e.g. "https://formspree.io/f/your-form-id" (must be https)
    method: "POST",
    // "json": sends application/json.  "form": sends multipart form data
    // (often the easiest with form services and avoids extra browser checks).
    format: "form",
    timeoutSeconds: 15,

    maxGuests: 4,                 // largest party size per response (including the guest)
    allowPlusOneNote: "Please include yourself in the number of guests.",

    privacyNote: "We will only use your details to plan the wedding.",
    demoNotice: "Demo mode: this form checks your answers but does not store or send anything.",
    demoSuccess: "This is a demonstration. Your response was not stored or sent. The couple will connect a real RSVP service before the invitation goes live.",
    successTitle: "Thank you, {name}",
    successAccept: "We are so happy you can join us. A copy of your answers is shown below.",
    successDecline: "We will miss you, and we are grateful you let us know.",
    errorMessage: "We could not send your response. Please check your connection and try again, or contact us directly."
  },

  /* ------------------------------------------------------------------------
     12. FAQ (add, remove or reorder freely; {deadline} and {contact} are replaced)
     ------------------------------------------------------------------------ */
  faq: {
    eyebrow: "Questions",
    heading: "Frequently\n*asked*",
    contact: "hello@example.com",     // REPLACE with a real address or phone number
    items: [
      { q: "What should I wear?",           a: "Garden formal. Soft pastels and greens are lovely; please leave white and ivory to the bride. The ceremony is on grass, so flats or block heels are kindest. A light layer is wise for the evening." },
      { q: "Can I bring a guest?",          a: "Your invitation names everyone we have saved a seat for. If you are unsure, please ask us at {contact}." },
      { q: "Is parking available?",         a: "Yes. Free on-site parking is available at Willowbrook Gardens. Please arrive early and share a car if you can." },
      { q: "Are children welcome?",         a: "We adore your little ones, but our celebration is an adults-only occasion, apart from children named on your invitation." },
      { q: "When should I RSVP?",           a: "Please reply by {deadline} so we can finalise the caterer and seating." },
      { q: "Who should I contact with questions?", a: "Write to us at {contact} and one of us will reply as soon as we can." }
    ]
  },

  /* ------------------------------------------------------------------------
     13. GIFTS
     ------------------------------------------------------------------------
     No payments are taken on this website. Buttons only appear when you add a
     link. The demo links point to example.com, a reserved placeholder domain.
     ------------------------------------------------------------------------ */
  gifts: {
    eyebrow: "Gifts",
    heading: "Your love is\n*the gift*",
    text: "Your presence at our wedding is the greatest gift. If you wish to give something as well, we would be grateful for a contribution to our honeymoon, or something from our small wish list. There is no obligation at all.",
    registryLabel: "View our gift list",
    registryUrl: "https://www.example.com/registry",     // REPLACE or set to ""
    fundLabel: "Contribute to our honeymoon",
    fundUrl: "https://www.example.com/honeymoon-fund"    // REPLACE or set to ""
  },

  /* ------------------------------------------------------------------------
     14. TRAVEL AND ACCOMMODATION
     ------------------------------------------------------------------------
     Set placeholder: true on a listing to show a "sample listing" label until
     you replace it with real information.
     ------------------------------------------------------------------------ */
  travel: {
    eyebrow: "Travel and stay",
    heading: "Getting here,\n*staying close*",
    venueNote: "Willowbrook Gardens is a 20-minute drive from Meadowvale station and 45 minutes from the airport.",
    notes: [
      "Taxis are available at the station; we recommend booking a return journey in advance.",
      "Rooms near the venue fill quickly in summer. We suggest booking by the end of March.",
      "A shuttle runs from the sample hotel to the venue before and after the ceremony."
    ],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Willowbrook+Gardens+12+Orchard+Lane+Meadowvale",
    mapLabel: "Open the map",
    accommodationHeading: "Where to stay",
    placeholderLabel: "Sample listing: replace before publishing",
    linkLabel: "View details",
    accommodations: [
      { name: "The Meadow Inn",        note: "Cosy village inn, 5 minutes from the venue.",        price: "from £110 per night", url: "https://www.example.com/meadow-inn", placeholder: true },
      { name: "Hartley Court Hotel",   note: "Country-house hotel with a daily shuttle to the venue.", price: "from £165 per night", url: "https://www.example.com/hartley-court", placeholder: true },
      { name: "Lavender Cottage B&B",  note: "Four quiet rooms and a famously good breakfast.",   price: "from £95 per night",  url: "", placeholder: true }
    ]
  },

  /* ------------------------------------------------------------------------
     15. FINAL INVITATION
     ------------------------------------------------------------------------ */
  finale: {
    heading: "We cannot wait to\n*celebrate with you.*",   // "\n" = line break, *word* = italic
    text: "With love and gratitude,",
    signature: "Amara & Daniel",
    button: "RSVP",
    image: {
      src: "assets/images/final-1280.webp",
      srcset: "assets/images/final-480.webp 480w, assets/images/final-1280.webp 1280w",
      width: 1280,
      height: 720,
      alt: "Amara and Daniel seen from behind, walking together through a golden meadow towards a line of cypress trees."
    }
  },

  /* ------------------------------------------------------------------------
     16. FOOTER
     ------------------------------------------------------------------------ */
  footer: {
    hashtag: "#AmaraAndDaniel2027",
    backToTopLabel: "Back to top",
    // Leave url as "" to hide a link.
    socials: [
      { label: "Instagram", url: "https://www.instagram.com/" },   // REPLACE with your account
      { label: "Pinterest", url: "" }
    ],
    // Template credit. Removing it requires the right licence (see LICENSE.txt).
    showAttribution: true,
    attributionText: "Website template by Your Studio Name",
    attributionUrl: ""           // optional link, e.g. "https://www.your-studio.com"
  }
};
