import type { ZodError, ZodIssue, ZodType } from 'zod';
import type { ProblemDetails } from '@room/contracts';

export interface FieldErrorState {
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly formError?: string;
  readonly requestId?: string;
}

export const EMPTY_FIELD_ERRORS: FieldErrorState = Object.freeze({ fieldErrors: {} });

function safeStringifyField(field: string | readonly PropertyKey[]): string {
  if (typeof field === 'string') return field;
  return field
    .map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : ''))
    .filter((segment) => segment.length > 0)
    .join('.');
}

function issueToFieldMessage(issue: ZodIssue): { field: string; message: string } {
  const field = issue.path.length > 0 ? safeStringifyField(issue.path) : 'body';
  return { field, message: issue.message };
}

export function fromZodError(error: ZodError): FieldErrorState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const { field, message } = issueToFieldMessage(issue);
    if (fieldErrors[field] === undefined) fieldErrors[field] = message;
  }
  return { fieldErrors };
}

export function fromProblemDetails(problem: ProblemDetails): FieldErrorState {
  const fieldErrors: Record<string, string> = {};
  for (const entry of problem.errors) {
    const key = entry.field === '' ? 'body' : entry.field;
    if (fieldErrors[key] === undefined) fieldErrors[key] = entry.message;
  }
  return {
    fieldErrors,
    ...(Object.keys(fieldErrors).length === 0 ? { formError: problem.detail } : {}),
    requestId: problem.requestId,
  };
}

export function fromUnknownError(cause: unknown, fallbackMessage: string): FieldErrorState {
  if (cause instanceof Error && cause.name === 'AbortError') return EMPTY_FIELD_ERRORS;
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'problem' in cause &&
    typeof (cause as { readonly problem?: unknown }).problem === 'object'
  ) {
    return fromProblemDetails((cause as { readonly problem: ProblemDetails }).problem);
  }
  return { fieldErrors: {}, formError: fallbackMessage };
}

export function safeValidateClient<T>(
  schema: ZodType<T>,
  input: unknown,
): { ok: true; value: T } | { ok: false; error: FieldErrorState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: fromZodError(parsed.error) };
}

export function pickFieldError(state: FieldErrorState, field: string): string | undefined {
  const direct = state.fieldErrors[field];
  if (direct !== undefined) return direct;
  if (field.includes('.')) {
    const root = field.split('.')[0] ?? field;
    return state.fieldErrors[root];
  }
  return undefined;
}
