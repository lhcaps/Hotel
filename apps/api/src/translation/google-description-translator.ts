import { createHash } from 'node:crypto';

const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_DESCRIPTION_LENGTH = 4_000;

export type ApprovedDescriptionKind =
  'property_description' | 'room_type_description' | 'amenity_description';

export interface ApprovedPublicDescription {
  readonly kind: ApprovedDescriptionKind;
  readonly sourceText: string;
  readonly targetLocale: 'en';
}

export interface GoogleDescriptionTranslatorOptions {
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
}

function containsProtectedData(value: string): boolean {
  return (
    /@/.test(value) ||
    /\b(?:\+?84|0)\d{8,10}\b/.test(value) ||
    /\b(?:MOMO|VNPAY|HOLD|CONFIRMED|CANCELLED|REVIEW_REQUIRED)\b/i.test(value) ||
    /\b(?:\d{1,3}(?:[.,]\d{3})+|\d+\s?VND)\b/i.test(value)
  );
}

function cacheKey(input: ApprovedPublicDescription): string {
  const digest = createHash('sha256').update(input.sourceText, 'utf8').digest('hex');
  return `${input.kind}:${input.targetLocale}:${digest}`;
}

/**
 * A narrow server-only boundary for approved, publicly displayed descriptions.
 * It fails closed to the original Vietnamese source: callers never need to
 * expose credentials or retry from a browser, and static application UI is not
 * routed through Google Cloud Translation.
 */
export class GoogleDescriptionTranslator {
  private readonly cache = new Map<string, string>();
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: GoogleDescriptionTranslatorOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async translate(input: ApprovedPublicDescription): Promise<string> {
    const sourceText = input.sourceText.trim();
    if (
      !this.options.enabled ||
      this.options.apiKey === undefined ||
      sourceText.length === 0 ||
      sourceText.length > MAX_DESCRIPTION_LENGTH ||
      containsProtectedData(sourceText)
    ) {
      return input.sourceText;
    }

    const key = cacheKey({ ...input, sourceText });
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const url = new URL(this.options.endpoint ?? GOOGLE_TRANSLATE_URL);
      url.searchParams.set('key', this.options.apiKey);
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: sourceText,
          source: 'vi',
          target: input.targetLocale,
          format: 'text',
        }),
        signal: controller.signal,
      });
      if (!response.ok) return input.sourceText;
      const body = (await response.json()) as {
        data?: { translations?: readonly { translatedText?: unknown }[] };
      };
      const translated = body.data?.translations?.[0]?.translatedText;
      if (typeof translated !== 'string' || translated.trim() === '') return input.sourceText;
      this.cache.set(key, translated);
      return translated;
    } catch {
      return input.sourceText;
    } finally {
      clearTimeout(timeout);
    }
  }
}
