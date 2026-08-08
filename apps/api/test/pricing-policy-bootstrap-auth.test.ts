import { describe, expect, it } from 'vitest';
import type { ApiEnvironment } from '@room/config';
import { PricingPolicyAdminController } from '../src/pricing-policy/pricing-policy.admin.controller.js';
import {
  OperationsV3PricingCatalogGate,
  PricingPolicyBootstrapDisabledError,
} from '../src/pricing-policy/pricing-policy.gate.js';

type EnvironmentSubset = Pick<
  ApiEnvironment,
  | 'NODE_ENV'
  | 'OPERATIONS_V3_B0_BOOTSTRAP_ENABLED'
  | 'OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED'
  | 'OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED'
>;

function createController(environment: EnvironmentSubset) {
  const catalogGate = new OperationsV3PricingCatalogGate(true);
  return new PricingPolicyAdminController(null as never, catalogGate, environment);
}

describe('PricingPolicyAdminController bootstrap authorization', () => {
  describe('development bootstrap gate', () => {
    it('allows bootstrap when NODE_ENV=development and OPERATIONS_V3_B0_BOOTSTRAP_ENABLED=true', () => {
      const controller = createController({
        NODE_ENV: 'development',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: true,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: false,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).not.toThrow();
    });

    it('denies bootstrap when NODE_ENV=development and OPERATIONS_V3_B0_BOOTSTRAP_ENABLED=false', () => {
      const controller = createController({
        NODE_ENV: 'development',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: false,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });
  });

  describe('production remediation gate', () => {
    it('denies bootstrap when NODE_ENV=production and remediation flag is unset', () => {
      const controller = createController({
        NODE_ENV: 'production',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: false,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });

    it('denies bootstrap when NODE_ENV=production and remediation flag is false', () => {
      const controller = createController({
        NODE_ENV: 'production',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: false,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });

    it('allows bootstrap when NODE_ENV=production, remediation=true, and PUBLIC=false', () => {
      const controller = createController({
        NODE_ENV: 'production',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: true,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).not.toThrow();
    });

    it('denies bootstrap when NODE_ENV=production, remediation=true, but PUBLIC=true', () => {
      const controller = createController({
        NODE_ENV: 'production',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: true,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: true,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });
  });

  describe('test/staging environment', () => {
    it('denies bootstrap when NODE_ENV=test regardless of flags', () => {
      const controller = createController({
        NODE_ENV: 'test',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: true,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: true,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });
  });

  describe('mutual exclusion', () => {
    it('development bootstrap flag is ignored in production', () => {
      const controller = createController({
        NODE_ENV: 'production',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: true,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: false,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });

    it('production remediation flag is ignored in development', () => {
      const controller = createController({
        NODE_ENV: 'development',
        OPERATIONS_V3_B0_BOOTSTRAP_ENABLED: false,
        OPERATIONS_V3_B0_PRODUCTION_REMEDIATION_ENABLED: true,
        OPERATIONS_V3_MULTI_NIGHT_PUBLIC_ENABLED: false,
      });

      expect(() => controller['assertBootstrapEnabled']()).toThrow(
        PricingPolicyBootstrapDisabledError,
      );
    });
  });
});
