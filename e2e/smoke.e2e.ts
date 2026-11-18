import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./signIn";

const SHARE_WITH = "https://bob.example/profile/card#me"; // fictional
const CONTENT = "Solid File Manager end-to-end test\n";

const item = (page: Page, kind: "File" | "Folder", name: string) =>
  page.locator(`[role=button][aria-label="${kind}: ${name}"]`);

async function contextMenu(page: Page, target: ReturnType<typeof item>, action: RegExp) {
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: action }).click();
}

test("signs in, browses, uploads, previews, shares and cleans up", async ({ page }, info) => {
  const storage = await signIn[info.project.name](page);
  const folder = `e2e-${Date.now()}`;
  const file = "e2e.txt";

  // Browse: open the storage.
  await page.getByRole("button", { name: `Folder: ${storage}` }).dblclick();
  await expect(page.getByRole("status").filter({ hasText: /item/ }).first()).toBeVisible();

  let passed = false;
  try {
    // Create a throwaway folder and open it.
    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("menuitem", { name: "New Folder" }).click();
    const newFolder = page.getByRole("dialog");
    await newFolder.getByRole("textbox").first().fill(folder);
    await newFolder.getByRole("button", { name: /Create/ }).click();
    await item(page, "Folder", folder).dblclick();
    await expect(page.getByText("No files or folders")).toBeVisible();

    // Upload a file, then read it back through the preview.
    await page.locator("input[type=file]").first().setInputFiles({
      name: file,
      mimeType: "text/plain",
      buffer: Buffer.from(CONTENT),
    });
    await expect(item(page, "File", file)).toBeVisible();
    await item(page, "File", file).dblclick();
    // Toasts are dialogs too, so the preview is picked by name.
    await expect(page.getByRole("dialog", { name: "Preview" })).toContainText(CONTENT.trim());
    await page.keyboard.press("Escape");

    // Share with a fictional WebID, check the list, then remove the access.
    if (info.project.name === "ess") {
      info.annotations.push({
        type: "skipped step",
        description: "ESS 3 refuses ACR writes naming a specific WebID (500), so sharing is not tested there.",
      });
    } else {
      const dialog = page.getByRole("dialog", { name: "Share", exact: true });
      const openShare = async () => {
        await contextMenu(page, item(page, "File", file), /Share/);
        await expect(dialog.getByText("Add a WebID")).toBeVisible();
      };
      await openShare();
      const input = dialog.getByRole("combobox").first();
      await input.fill(SHARE_WITH);
      await input.press("Enter");
      await expect(dialog.getByText(SHARE_WITH)).toBeVisible();
      await dialog.getByRole("combobox", { name: "Access level" }).selectOption("Viewer");
      await dialog.getByRole("button", { name: "Share", exact: true }).click();
      await expect(dialog).toBeHidden();

      await openShare();
      const row = dialog.locator("div.rounded-md.border").filter({ hasText: SHARE_WITH });
      await expect(row).toContainText("Viewer");
      await dialog.getByRole("button", { name: `Remove access for ${SHARE_WITH}` }).click();
      await expect(row).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // The removal was saved, not just dropped from the list on screen.
      await openShare();
      await page.waitForLoadState("networkidle"); // the access list has been read
      await expect(dialog.getByText(SHARE_WITH)).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    passed = true;
  } finally {
    // Clean up: close any dialog, go back to the storage root and delete the
    // throwaway folder. If the test already failed, a cleanup problem only
    // warns, so it can't hide that error; otherwise it fails the test, since
    // something was left behind on a real account.
    try {
      const modal = page.locator("[data-slot=dialog-content]");
      for (let i = 0; i < 3 && (await modal.count()) > 0; i += 1) await page.keyboard.press("Escape");
      await page.getByRole("button", { name: storage, exact: true }).first().click({ timeout: 15_000 });
      const leftover = item(page, "Folder", folder);
      await leftover.waitFor({ timeout: 15_000 });
      await leftover.click({ button: "right", timeout: 15_000 });
      await page.getByRole("menuitem", { name: /Delete/ }).click({ timeout: 15_000 });
      await page.getByRole("alertdialog").getByRole("button", { name: /Delete/ }).click({ timeout: 15_000 });
      await expect(leftover).toHaveCount(0, { timeout: 30_000 });
    } catch (error) {
      const message = `Couldn't clean up ${storage}${folder}/: ${error instanceof Error ? error.message.split("\n")[0] : error}`;
      if (passed) throw new Error(message);
      console.warn(message);
    }
  }
});
