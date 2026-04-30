/**
 * Per-audiobook external purchase links (physical edition).
 *
 * Keyed by show slug — same key the rest of the app uses for
 * `getShowColors`, `findBookForShow`, etc. When a slug has an entry
 * here, the audiobook show page renders a "Buy Physical" CTA in the
 * hero action row that deep-links to the listed retailer.
 *
 * To add a new title, drop in another entry. To temporarily hide a
 * link (e.g. while the print run is sold out) just delete it; the
 * UI gracefully omits the button when no URL is present.
 */
const AUDIOBOOK_PURCHASE_LINKS = {
  'westfall':                        { url: 'https://a.co/d/09A0OJUr', retailer: 'Amazon' },
  'lore-a-folklore-horror-novel':    { url: 'https://a.co/d/0dP6EO7v', retailer: 'Amazon' },
  'drakenblud-the-malformed-king':   { url: 'https://a.co/d/0j85AQrR', retailer: 'Amazon' },
  // 'dogwood-a-southern-gothic-body-horror-novel': not yet available
};

/**
 * Look up the purchase link for a given show object. Returns null if
 * the show has no associated retail listing yet.
 */
export function getAudiobookPurchaseLink(show) {
  if (!show) return null;
  const slug = show.slug;
  if (slug && AUDIOBOOK_PURCHASE_LINKS[slug]) return AUDIOBOOK_PURCHASE_LINKS[slug];
  return null;
}

export default AUDIOBOOK_PURCHASE_LINKS;
