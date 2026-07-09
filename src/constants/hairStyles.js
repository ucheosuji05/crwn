// Single source of truth for the onboarding "What styles speak to you?" mosaic.
// Metro/RN can't require() a dynamically built string, so every image below
// is a static require() call grouped by category.

export const HAIR_STYLE_CATEGORIES = ['Protective', 'Cuts', 'Natural', 'Locs', 'Short', 'Color'];

export const HAIR_STYLES = [
  // ── Protective ──────────────────────────────────────────────────────────
  { id: 'bantu-knots',     label: 'Bantu Knots',     category: 'Protective', height: 210, image: require('../../assets/images/protective/bantu-knots.png') },
  { id: 'braids',          label: 'Braids',          category: 'Protective', height: 235, image: require('../../assets/images/protective/braids.png') },
  { id: 'cornrows',        label: 'Cornrows',        category: 'Protective', height: 200, image: require('../../assets/images/protective/cornrows.png') },
  { id: 'crochet-styles',  label: 'Crochet Styles',  category: 'Protective', height: 225, image: require('../../assets/images/protective/crochet-styles.png') },
  { id: 'knotless-braids', label: 'Knotless Braids', category: 'Protective', height: 245, image: require('../../assets/images/protective/knotless-braids.png') },
  { id: 'mini-twists',     label: 'Mini Twists',     category: 'Protective', height: 205, image: require('../../assets/images/protective/mini-twists.png') },
  { id: 'twists',          label: 'Twists',          category: 'Protective', height: 220, image: require('../../assets/images/protective/twists.png') },
  { id: 'wigs-weaves',     label: 'Wigs & Weaves',   category: 'Protective', height: 215, image: require('../../assets/images/protective/wigs-weaves.png') },

  // ── Cuts ────────────────────────────────────────────────────────────────
  { id: 'curly-cuts',      label: 'Curly Cuts',      category: 'Cuts',       height: 230, image: require('../../assets/images/cuts/curly-cuts.png') },
  { id: 'fades',           label: 'Fades',           category: 'Cuts',       height: 200, image: require('../../assets/images/cuts/fades.png') },
  { id: 'line-ups',        label: 'Line Ups',        category: 'Cuts',       height: 220, image: require('../../assets/images/cuts/line-ups.png') },
  { id: 'trims',           label: 'Trims',           category: 'Cuts',       height: 205, image: require('../../assets/images/cuts/trims.png') },

  // ── Natural ─────────────────────────────────────────────────────────────
  { id: 'afro',              label: 'Afro',              category: 'Natural', height: 215, image: require('../../assets/images/natural/afro.png') },
  { id: 'braid-out',         label: 'Braid Out',         category: 'Natural', height: 240, image: require('../../assets/images/natural/braid-out.png') },
  { id: 'flat-twist',        label: 'Flat Twist',        category: 'Natural', height: 205, image: require('../../assets/images/natural/flat-twist.png') },
  { id: 'pineapple',         label: 'Pineapple',         category: 'Natural', height: 225, image: require('../../assets/images/natural/pineapple.png') },
  { id: 'straight-natural',  label: 'Straight Natural',  category: 'Natural', height: 200, image: require('../../assets/images/natural/straight-natural.png') },
  { id: 'twist-out',         label: 'Twist Out',         category: 'Natural', height: 235, image: require('../../assets/images/natural/twist-out.png') },

  // ── Locs ────────────────────────────────────────────────────────────────
  { id: 'freeform-locs',    label: 'Freeform Locs',    category: 'Locs', height: 220, image: require('../../assets/images/locs/freeform-locs.png') },
  { id: 'locs-barrels',     label: 'Locs Barrels',     category: 'Locs', height: 200, image: require('../../assets/images/locs/locs-barrels.png') },
  { id: 'locs-braid-out',   label: 'Locs Braid Out',   category: 'Locs', height: 245, image: require('../../assets/images/locs/locs-braid-out.png') },
  { id: 'locs-retwist',     label: 'Locs Retwist',     category: 'Locs', height: 210, image: require('../../assets/images/locs/locs-retwist.png') },
  { id: 'locs-style',       label: 'Locs Style',       category: 'Locs', height: 230, image: require('../../assets/images/locs/locs-style.png') },
  { id: 'locs-two-strand',  label: 'Locs Two Strand',  category: 'Locs', height: 205, image: require('../../assets/images/locs/locs-two-strand.png') },
  { id: 'sister-locs',      label: 'Sister Locs',      category: 'Locs', height: 225, image: require('../../assets/images/locs/sister-locs.png') },

  // ── Short ───────────────────────────────────────────────────────────────
  { id: 'bixie',         label: 'Bixie',         category: 'Short', height: 210, image: require('../../assets/images/short/bixie.png') },
  { id: 'finger-waves',  label: 'Finger Waves',  category: 'Short', height: 235, image: require('../../assets/images/short/finger-waves.png') },
  { id: 'mini-afro',     label: 'Mini Afro',     category: 'Short', height: 200, image: require('../../assets/images/short/mini-afro.png') },
  { id: 'twa',           label: 'TWA',           category: 'Short', height: 220, image: require('../../assets/images/short/twa.png') },
  { id: 'waves',         label: 'Waves',         category: 'Short', height: 205, image: require('../../assets/images/short/waves.png') },

  // ── Color ───────────────────────────────────────────────────────────────
  { id: 'ash-blonde',  label: 'Ash Blonde',  category: 'Color', height: 215, image: require('../../assets/images/color/ash-blonde.png') },
  { id: 'blonde',      label: 'Blonde',      category: 'Color', height: 240, image: require('../../assets/images/color/blonde.png') },
  { id: 'blue',        label: 'Blue',        category: 'Color', height: 200, image: require('../../assets/images/color/blue.png') },
  { id: 'brown',       label: 'Brown',       category: 'Color', height: 225, image: require('../../assets/images/color/brown.png') },
  { id: 'ginger',      label: 'Ginger',      category: 'Color', height: 210, image: require('../../assets/images/color/ginger.png') },
  { id: 'highlights',  label: 'Highlights',  category: 'Color', height: 230, image: require('../../assets/images/color/highlights.png') },
];
