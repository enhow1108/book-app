/** True when the 13 digits carry a correct EAN-13 check digit. */
export function validEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** An ISBN-13 (978/979). Only these are worth looking up in book databases. */
export const isIsbn13 = (code: string) => /^97[89]\d{10}$/.test(code) && validEan13(code);

/**
 * Whether a scanned barcode can stand for a book. Besides ISBNs this takes the other EAN-13 codes
 * books carry instead, such as the 491/492 magazine codes on Japanese monthly picture books
 * (こどものとも and the like have no ISBN). It skips the codes printed next to an ISBN that are not
 * the book: Japan's 192/191 price-and-category bar under the 978 bar, and 2xx in-store price stickers.
 */
export function isBookBarcode(code: string): boolean {
  if (!validEan13(code)) return false;
  if (code.startsWith('19') || code.startsWith('2')) return false;
  return true;
}
