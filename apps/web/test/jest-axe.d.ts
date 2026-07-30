declare module 'jest-axe' {
  export const axe: (
    container: Element | Document,
    options?: Record<string, unknown>,
  ) => Promise<{
    violations: ReadonlyArray<{ id: string; impact?: string | null; description: string; nodes: ReadonlyArray<unknown> }>;
    incomplete: ReadonlyArray<unknown>;
    passes: ReadonlyArray<unknown>;
    inapplicable: ReadonlyArray<unknown>;
    [key: string]: unknown;
  }>;
  export const toHaveNoViolations: unknown;
  const defaults: unknown;
  export default defaults;
}
