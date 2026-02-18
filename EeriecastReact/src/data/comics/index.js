/**
 * Comic registry — maps comic IDs to their data modules.
 * When adding a new comic, import it here and add an entry to COMIC_CATALOG.
 *
 * The comic reader looks up comics by ID from this catalog.
 */

import sampleComic from "./sample-comic";

const COMIC_CATALOG = [
  sampleComic,
];

/**
 * Find a comic by its unique ID.
 * @param {string} id
 * @returns {object|null}
 */
export function findComicById(id) {
  if (!id) return null;
  return COMIC_CATALOG.find((c) => c.id === id) || null;
}

export default COMIC_CATALOG;
