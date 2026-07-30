export interface CommandInvocation {
  readonly executable: string;
  readonly args: readonly string[];
}

export function resolvePnpmInvocation(args: readonly string[]): CommandInvocation;
export function resolveCommandInvocation(
  command: string,
  args: readonly string[],
): CommandInvocation;
