/**
 * Book registry — maps book IDs (slugs) to their data modules.
 * When adding a new book, import it here and add an entry to BOOK_CATALOG.
 *
 * The e-reader looks up books by matching the podcast/show title against
 * each book's title (case-insensitive, partial match).
 */

import callOfCthulhu from "./call-of-cthulhu";
import drakenbludTheMalformedKing from "./drakenblud-the-malformed-king";
import lore from "./lore";

const BOOK_CATALOG = [
  callOfCthulhu,
  drakenbludTheMalformedKing,
  lore,
];

/**
 * Find a book matching the given show/podcast title.
 * Uses case-insensitive containment so "Drakenblud: The Malformed King — Audiobook"
 * still matches a book titled "Drakenblud: The Malformed King".
 * Prefers exact matches, then word-boundary matches, then substring matches.
 */
export function findBookForShow(show) {
  if (!show) return null;
  const showTitle = (show.title || show.name || "").toLowerCase();
  if (!showTitle) return null;

  // Exact match first
  const exact = BOOK_CATALOG.find((b) => b.title.toLowerCase() === showTitle);
  if (exact) return exact;

  // Word-boundary match (book title appears as a whole word in the show title)
  const wordMatch = BOOK_CATALOG.find((book) => {
    const bt = book.title.toLowerCase();
    const re = new RegExp(`(^|[\\s:—–\\-])${bt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s:—–\\-])`, "i");
    return re.test(showTitle);
  });
  if (wordMatch) return wordMatch;

  // Fallback: substring containment
  return (
    BOOK_CATALOG.find((book) => {
      const bookTitle = book.title.toLowerCase();
      return showTitle.includes(bookTitle) || bookTitle.includes(showTitle);
    }) || null
  );
}

export default BOOK_CATALOG;
