export interface AccessCredentialProvider {
  readonly provider: 'DEMO';
  isHealthy(): Promise<boolean>;
  createCredential(input: {
    readonly bookingId: string;
    readonly validFrom: Date;
  }): Promise<{ readonly providerCredentialReference: string }>;
}

/**
 * The Demo adapter deliberately returns a provider reference, never a door
 * code or an unlock payload. A future real adapter must preserve that
 * reference-only contract.
 */
export class DemoAccessCredentialProvider implements AccessCredentialProvider {
  public readonly provider = 'DEMO' as const;

  public async isHealthy(): Promise<boolean> {
    return true;
  }

  public async createCredential(input: {
    readonly bookingId: string;
    readonly validFrom: Date;
  }): Promise<{ readonly providerCredentialReference: string }> {
    return {
      providerCredentialReference: `demo-${input.bookingId}-${input.validFrom.getTime()}`,
    };
  }
}
