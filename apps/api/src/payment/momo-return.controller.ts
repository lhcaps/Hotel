import { Controller, Get, HttpCode, Version } from '@nestjs/common';

/** Browser query parameters are never payment evidence; settlement is IPN-only. */
@Controller('payments/providers/momo')
export class MomoReturnController {
  @Get('return')
  @Version('1')
  @HttpCode(204)
  public readOnlyReturn(): void {}
}
