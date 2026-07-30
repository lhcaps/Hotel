import { Body, Controller, Get, Inject, Param, Post, Version } from '@nestjs/common';
import { QuoteService } from './quote.service.js';
@Controller('quotes')
export class QuoteController {
  public constructor(@Inject(QuoteService) private readonly quotes: QuoteService) {}
  @Post('offers') @Version('1') public eligibleOffers(@Body() body: unknown) {
    return this.quotes.eligibleOffers(body);
  }
  @Post() @Version('1') public issue(@Body() body: unknown) {
    return this.quotes.issue(body);
  }
  @Get(':id') @Version('1') public get(@Param('id') id: string) {
    return this.quotes.get(id);
  }
}
