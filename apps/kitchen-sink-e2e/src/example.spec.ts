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
  expect(await page.locator('h1').innerText()).toContain('Ngx Build Demo');

  expect(jsRequests.length).toBeLessThanOrEqual(4);
});
