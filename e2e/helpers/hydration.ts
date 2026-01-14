/**
 * React SSR hydration resets controlled form inputs.
 * These helpers ensure forms are ready before interaction.
 */
import { Page, expect } from '@playwright/test';
import { TIMEOUTS, HYDRATION_WAIT } from '../config/timeouts';

/**
 * Wait for a form to be hydrated (React has taken over).
 * Forms should set data-hydrated="true" in useEffect.
 *
 * @example
 * // In React component:
 * useEffect(() => {
 *   formRef.current?.setAttribute('data-hydrated', 'true');
 * }, []);
 */
export async function waitForFormReady(page: Page, formSelector = 'form') {
  await page.waitForSelector(`${formSelector}[data-hydrated="true"]`, {
    state: 'attached',
    ...HYDRATION_WAIT,
  });
  // Small delay for any final React updates
  await page.waitForTimeout(TIMEOUTS.ANIMATION);
}

/**
 * Fill a form field and verify the value wasn't cleared by hydration.
 */
export async function fillFormField(page: Page, selector: string, value: string) {
  const field = page.locator(selector);
  await field.fill(value);
  // Verify value wasn't cleared by hydration
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INPUT_STABLE });
}
