import { test, expect } from '@playwright/test';

test.describe('Enterprise Authentication & Dashboard Navigation', () => {
  test('should display login page and authenticate successfully', async ({ page }) => {
    await page.goto('/login');

    // Verify title and input fields
    await expect(page).toHaveTitle(/MyStore/i);
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Fill credentials
    await emailInput.fill('admin@demo.test');
    await passwordInput.fill('Admin123!');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify successful authentication and redirection
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should navigate to products catalog and render data table', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveTitle(/MyStore/i);

    // Ensure data table or page header exists
    const heading = page.locator('h1, h2, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });
});
