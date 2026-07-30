import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import * as paymentModuleExports from '../../src/payment/payment.module.js';

const paymentModule = paymentModuleExports as typeof paymentModuleExports & {
  PaymentModule: object;
};

describe('PaymentModule', () => {
  it('exposes the dual-provider initiation, verified IPN, read-only return, and safe status boundaries', () => {
    const controllers: unknown = Reflect.getMetadata('controllers', paymentModule.PaymentModule);
    const controllerItems: unknown[] = Array.isArray(controllers) ? controllers : [];
    const names = controllerItems.map((controller) =>
      typeof controller === 'function' ? controller.name : String(controller),
    );
    expect(names).toEqual([
      'MomoPaymentController',
      'MomoWebhookController',
      'MomoReturnController',
      'VnpayPaymentController',
      'VnpayWebhookController',
      'VnpayReturnController',
      'PaymentProviderController',
      'AdminPaymentProviderController',
      'AdminPaymentReconciliationController',
      'PaymentStatusController',
    ]);
  });
});
