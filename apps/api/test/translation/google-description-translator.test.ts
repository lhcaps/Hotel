import { describe, expect, it, vi } from 'vitest';

import { GoogleDescriptionTranslator } from '../../src/translation/google-description-translator.js';

describe('GoogleDescriptionTranslator', () => {
  it('uses a deterministic local fake only for approved Vietnamese public descriptions and caches by hash', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { translations: [{ translatedText: 'Quiet room with a view' }] } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const translator = new GoogleDescriptionTranslator({
      enabled: true,
      apiKey: 'translation-key-that-is-long-enough',
      timeoutMs: 500,
      endpoint: 'https://translation.example.test/v2',
      fetchImpl,
    });

    await expect(
      translator.translate({
        kind: 'room_type_description',
        sourceText: 'Phòng yên tĩnh, nhìn ra sân vườn.',
        targetLocale: 'en',
      }),
    ).resolves.toBe('Quiet room with a view');
    await translator.translate({
      kind: 'room_type_description',
      sourceText: 'Phòng yên tĩnh, nhìn ra sân vườn.',
      targetLocale: 'en',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requestUrl.origin).toBe('https://translation.example.test');
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toBe(
      JSON.stringify({
        q: 'Phòng yên tĩnh, nhìn ra sân vườn.',
        source: 'vi',
        target: 'en',
        format: 'text',
      }),
    );
  });

  it('falls back without credentials, when disabled, or when text looks like protected data', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const translator = new GoogleDescriptionTranslator({
      enabled: false,
      timeoutMs: 500,
      fetchImpl,
    });

    await expect(
      translator.translate({
        kind: 'property_description',
        sourceText: 'Khách sạn gần hồ.',
        targetLocale: 'en',
      }),
    ).resolves.toBe('Khách sạn gần hồ.');
    await expect(
      new GoogleDescriptionTranslator({
        enabled: true,
        apiKey: 'translation-key-that-is-long-enough',
        timeoutMs: 500,
        fetchImpl,
      }).translate({
        kind: 'property_description',
        sourceText: 'Liên hệ guest@example.test để nhận giá 500.000 VND.',
        targetLocale: 'en',
      }),
    ).resolves.toBe('Liên hệ guest@example.test để nhận giá 500.000 VND.');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back after a provider error without exposing a retry surface to the browser', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
    const translator = new GoogleDescriptionTranslator({
      enabled: true,
      apiKey: 'translation-key-that-is-long-enough',
      timeoutMs: 500,
      fetchImpl,
    });

    await expect(
      translator.translate({
        kind: 'amenity_description',
        sourceText: 'Bữa sáng phục vụ tại phòng.',
        targetLocale: 'en',
      }),
    ).resolves.toBe('Bữa sáng phục vụ tại phòng.');
  });
});
