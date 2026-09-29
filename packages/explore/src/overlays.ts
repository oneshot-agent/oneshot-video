/**
 * Close what a site opens over itself on load: a welcome popup, a newsletter prompt, a cookie
 * banner, a migration notice. Left open, it sits over every still and blocks every click. Escape
 * first; then the first visible close control, if any. Does nothing on a page without one.
 */
import type { Page } from "playwright";

const CLOSE_CONTROLS = [
  '[role="dialog"] [aria-label*="close" i]',
  '[aria-modal="true"] [aria-label*="close" i]',
  'button[aria-label*="close" i]',
  'button:has-text("Maybe later")',
  'a:has-text("Maybe later")',
  'button:has-text("No thanks")',
  'button:has-text("Not now")',
  'button:has-text("Accept all")',
  'button:has-text("Accept")',
  'button:has-text("Got it")',
  '[role="dialog"] button:has-text("×")',
  '[role="dialog"] button:has-text("✕")',
];

export async function dismissOverlays(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  for (const sel of CLOSE_CONTROLS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
      break;
    }
  }
}
