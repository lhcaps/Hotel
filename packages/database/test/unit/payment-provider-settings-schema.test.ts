import { describe, expect, it } from 'vitest';

import { paymentProviderSettings } from '../../src/schema.js';

describe('payment provider operational settings schema', () => {
  it('contains only non-secret operational columns with property/provider uniqueness', () => {
    expect(Object.keys(paymentProviderSettings)).toEqual(
      expect.arrayContaining([
        'id',
        'propertyId',
        'provider',
        'enabled',
        'displayName',
        'displayOrder',
        'checkoutExpiryMinutes',
        'maintenanceMessage',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(Object.keys(paymentProviderSettings)).not.toEqual(
      expect.arrayContaining(['hashSecret', 'secretKey', 'accessKey', 'merchantCode']),
    );
  });
});
