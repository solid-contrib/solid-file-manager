/**
 * Stand-in for `jsonld` in unit tests (see vitest.config.mts).
 *
 * @inrupt/solid-client only uses jsonld to parse JSON-LD responses. The real
 * package cannot load under Node 26 (its HTTP client relies on the obsolete
 * `esm` loader), so tests get this stub instead, which fails loudly if a test
 * ever needs JSON-LD parsing.
 */
export function toRDF(): never {
  throw new Error("JSON-LD parsing is not available in unit tests (jsonld is stubbed).");
}
