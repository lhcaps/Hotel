import { expect, test } from '@playwright/test';

import { availabilitySearchResponseSchema } from '@room/contracts';

test('the E2E worker loads workspace contract schemas', () => {
  expect(availabilitySearchResponseSchema).toBeDefined();
});
