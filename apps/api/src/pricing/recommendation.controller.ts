import { Body, Controller, Inject, Post, Version } from '@nestjs/common';
import type { DatabaseClient } from '@room/database';
import { recommendationResponseSchema } from '@room/contracts';
import { RecommendationRepository, parseRecommendationRequest } from './recommendation.repository.js';
import { QuoteRepository } from './quote.repository.js';
import { CouponRepository } from './coupon.repository.js';
import { recommendationStayTimes } from './recommendation.routes.js';
import type { RecommendationResult } from './recommendation.service.js';

type RecommendationDatabase = Pick<DatabaseClient, 'execute' | 'query' | 'insert'>;

interface RecommendationServiceOptions {
  readonly couponRepository?: CouponRepository;
}

@Controller('recommendations')
export class RecommendationController {
  public constructor(
    @Inject('DatabaseClient') private readonly database: RecommendationDatabase,
    @Inject('RecommendationOptions')
    private readonly options: RecommendationServiceOptions = {},
  ) {}

  @Post('stay-times')
  @Version('1')
  public async stayTimes(@Body() body: unknown): Promise<RecommendationResult> {
    const request = parseRecommendationRequest(body);
    const result = await recommendationStayTimes(request, {
      database: this.database,
      quoteRepository: new QuoteRepository(this.database),
      recommendationRepository: new RecommendationRepository(this.database),
      ...(this.options.couponRepository !== undefined
        ? { couponRepository: this.options.couponRepository }
        : {}),
    });
    return recommendationResponseSchema.parse(result);
  }
}