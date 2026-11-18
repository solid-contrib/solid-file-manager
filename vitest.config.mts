import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("."),
      // jsonld cannot load under Node 26; tests use a stub. See the stub's comment.
      jsonld: fromRoot("app/lib/testing/jsonldStub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    restoreMocks: true,
    // Processed by Vite rather than plain Node, so the jsonld alias applies.
    server: { deps: { inline: ["@inrupt/solid-client"] } },
  },
});
