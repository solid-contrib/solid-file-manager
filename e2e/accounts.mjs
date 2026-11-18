// The fictional account on the throwaway local server (see start-css.mjs).
// Its password is made up afresh for each run by playwright.config.ts and
// shared through E2E_LOCAL_PASSWORD, so none is kept in the repository.
// Real test accounts for solidcommunity.net and ESS come from .env.local.
export const LOCAL_ACCOUNT = {
  issuer: "http://localhost:3000/",
  email: "e2e@example.org",
  get password() {
    const secret = process.env.E2E_LOCAL_PASSWORD;
    if (!secret) throw new Error("E2E_LOCAL_PASSWORD is not set; run the tests with npm run test:e2e.");
    return secret;
  },
  pod: "e2e",
};
