import { describe, expect, it } from 'vitest';

import { extractRouteDecorators } from './endpoint-inventory.mts';

describe('extractRouteDecorators', () => {
  it('does not classify decorator-shaped comments as runtime endpoints', () => {
    const source = `
      // @Get('*')
      /* @Post('internal') */
      @Get('*')
      handleGet() {}
      @Post('*')
      handlePost() {}
    `;

    expect(extractRouteDecorators(source)).toEqual([
      { method: 'get', path: '*' },
      { method: 'post', path: '*' },
    ]);
  });
});
