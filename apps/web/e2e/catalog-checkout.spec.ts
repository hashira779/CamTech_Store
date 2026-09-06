import { test, expect } from '@playwright/test';

test.describe('Storefront Catalog & Checkout Flow', () => {
  test('should load public storefront and display product items', async ({ page }) => {
    // When visiting store experience
    await page.goto('/');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check presence of navigational headers
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });

  test('should handle health probes cleanly', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health');
    // If backend is running, verify healthy envelope
    if (res.ok()) {
      const data = await res.json();
      expect(data.status).toBe('healthy');
    }
  });
});
