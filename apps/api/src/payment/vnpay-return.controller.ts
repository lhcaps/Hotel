import { Controller, Get, HttpCode, Version } from '@nestjs/common';

/** Browser return values are never payment evidence; verified VNPAY IPN owns settlement. */
@Controller('payments/providers/vnpay')
export class VnpayReturnController {
  @Get('return') @Version('1') @HttpCode(204) public readOnlyReturn(): void {}
}
