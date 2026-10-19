import { test, expect } from '@playwright/test';

test('sign in, inspect live records, switch language and sign out', async ({ page }) => {
  const email = process.env.WAFOU_ADMIN_EMAIL;
  const password = process.env.WAFOU_ADMIN_PASSWORD;
  test.skip(!email || !password, 'Live admin credentials must be supplied through environment');
  await page.goto('/');
  await page.getByLabel('Adresse email').fill(email!);
  await page.getByLabel('Mot de passe').fill(password!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre activité, en un coup d’œil.' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Activité récente')).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('menuitem', { name: 'Services', exact: true }).click();
  await expect(page.getByText('[DEMO] Entretien régulier', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/services-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Olankoande' }).click();
  await page.getByRole('menuitem', { name: /Log out/ }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.goto('/#/payments');
  await expect(page.getByLabel('Email address')).toBeVisible();
});
