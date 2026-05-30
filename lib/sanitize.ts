/**
 * lib/sanitize.ts — strips HTML/script tags from user-supplied text.
 *
 * Uses isomorphic-dompurify so it works on both server (Node) and client.
 * Config: ALLOWED_TAGS: [] means all HTML is stripped, leaving plain text only.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Strips all HTML tags and attributes from a string.
 * Safe to call on any user input before persisting to DB.
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}
