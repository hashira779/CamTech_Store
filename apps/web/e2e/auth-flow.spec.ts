import { test, expect } from '@playwright/test';

test.describe('Enterprise Authentication & Dashboard Navigation', () => {
  test('should display login page and authenticate successfully', async ({ page }) => {
    // Intercept login API call with valid enterprise mock response
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: 'mock-jwt-token-for-e2e',
            refreshToken: 'mock-refresh-token',
            user: {
              id: 'usr_mock_1',
              email: 'admin@demo.test',
              name: 'Demo Admin',
              roles: ['ORG_ADMIN'],
              organizationId: 'org_demo_1',
            },
          },
          requestId: 'req_mock_e2e_1',
        }),
      });
    });

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

    // Verify show/hide password toggle functionality
    const toggleBtn = page.locator('button[title="Show password"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    const hideBtn = page.locator('button[title="Hide password"]');
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify successful authentication and redirection
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should navigate to products catalog and render data table', async ({ page }) => {
    // Intercept products API query
    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 'p1', name: 'MacBook Pro 16', sku: 'MBP-16-M3', price: 2499, isActive: true },
            ],
            total: 1,
            page: 1,
            limit: 20,
          },
          requestId: 'req_mock_e2e_2',
        }),
      });
    });

    await page.goto('/products');
    await expect(page).toHaveTitle(/MyStore/i);

    // Ensure data table or page header exists
    const heading = page.locator('h1, h2, [role="heading"]').first();
    await expect(heading).toBeVisible();
  });
});
