import { expect, type Locator, type Page } from "@playwright/test";
import { LOCAL_ACCOUNT } from "./accounts.mjs";

/** Signs in and returns the storage to test in. */
export type SignIn = (page: Page) => Promise<string>;

/**
 * Types a credential. Any error is replaced with one that names only the
 * field, so the value can't reach logs or reports, whatever Playwright's
 * error text contains.
 */
async function fillSecret(field: Locator, value: string, label: string) {
  try {
    await field.fill(value);
  } catch {
    throw new Error(`Couldn't fill the ${label} field.`);
  }
}

/** Starts at the app's login page and continues to the identity provider. */
async function chooseProvider(page: Page, issuer: string) {
  // A fresh session each time, so earlier logins don't leak in.
  await page.goto("/file-manager-logo.svg");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto("/login");
  const provider = page.getByRole("combobox", { name: "Solid Identity Provider" });
  await provider.fill(issuer);
  await provider.press("Escape");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
}

/** Community Solid Server's login and consent pages (local server and solidcommunity.net). */
async function cssLogin(page: Page, email: string, password: string, webId?: string): Promise<string> {
  const radio = page.getByRole("radio").first();
  const email_ = page.locator("#email");
  await expect(email_.or(radio)).toBeVisible();
  if (await email_.isVisible()) {
    await page.waitForLoadState("networkidle");
    await fillSecret(email_, email, "email");
    await fillSecret(page.locator("#password"), password, "password");
    await page.locator("button[type=submit]").click();
  }
  const choice = webId ? page.getByRole("radio", { name: webId }) : radio;
  await choice.check();
  const chosen = (await choice.getAttribute("value")) ?? (await choice.getAttribute("aria-label")) ?? "";
  await page.getByRole("button", { name: "Authorize" }).click();
  await page.waitForURL("http://localhost:3001/");
  return chosen;
}

export const signIn: Record<string, SignIn> = {
  "local-css": async (page) => {
    await chooseProvider(page, LOCAL_ACCOUNT.issuer);
    await cssLogin(page, LOCAL_ACCOUNT.email, LOCAL_ACCOUNT.password);
    return `${LOCAL_ACCOUNT.issuer}${LOCAL_ACCOUNT.pod}/`;
  },

  solidcommunity: async (page) => {
    await chooseProvider(page, "https://solidcommunity.net/");
    const webId = await cssLogin(
      page,
      process.env.CSS_TEST_USERNAME!,
      process.env.CSS_TEST_PASSWORD!,
      process.env.CSS_TEST_WEBID,
    );
    // solidcommunity.net pods are their own subdomains, holding the WebID.
    return `${new URL(process.env.CSS_TEST_WEBID ?? webId).origin}/`;
  },

  ess: async (page) => {
    await chooseProvider(page, process.env.ESS_ISSUER ?? "https://openid.odi.ess.solid-experiments.org");
    const username = page.getByRole("textbox", { name: "Username" });
    await fillSecret(username, process.env.ESS_TEST_USERNAME!, "username");
    await fillSecret(page.getByRole("textbox", { name: "Password" }), process.env.ESS_TEST_PASSWORD!, "password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("http://localhost:3001/");
    // The storage must be found from the profile's pim:storage, never added by
    // hand, so the test fails if discovery stops working.
    const found = page.locator('[role=button][aria-label^="Folder: "]').first();
    await expect(found).toBeVisible();
    const storage = (await found.getAttribute("aria-label"))!.slice("Folder: ".length);
    // Optionally, check it's the expected one.
    if (process.env.ESS_TEST_STORAGE_URL) expect(storage).toBe(process.env.ESS_TEST_STORAGE_URL);
    return storage;
  },
};
