import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {

  const jsRequests: string[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.endsWith('.js')) {
      jsRequests.push(url);
    }
  });

  await page.goto('/');

  await page.waitForLoadState('networkidle');
  // Expect h1 to contain a substring.
  expect(await page.locator('h1').innerText()).toContain('App Root');

  expect(jsRequests.length).toBeLessThanOrEqual(2);
});

