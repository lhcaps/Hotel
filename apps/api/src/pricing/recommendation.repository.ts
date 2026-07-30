import { type DatabaseClient } from '@room/database';
import { createQuoteRequestSchema, type CreateQuoteRequest } from '@room/contracts';

export type RecommendationRequest = CreateQuoteRequest;

type Database = Pick<DatabaseClient, 'query'>;

export class RecommendationRepository {
  public constructor(private readonly database: Database) {}

  public async isCandidateAvailable(input: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly roomTypeId: string;
    readonly adults: number;
    readonly children: number;
  }): Promise<boolean> {
    const property = await this.database.query.properties.findFirst({
      where: (item, operators) => operators.eq(item.status, 'ACTIVE'),
      orderBy: (item, operators) => [operators.asc(item.createdAt), operators.asc(item.id)],
    });
    if (property === undefined) return false;
    const roomType = await this.database.query.roomTypes.findFirst({
      where: (row, op) =>
        op.and(
          op.eq(row.id, input.roomTypeId),
          op.eq(row.propertyId, property.id),
          op.eq(row.status, 'ACTIVE'),
        ),
    });
    if (
      roomType === undefined ||
      roomType.maxAdults < input.adults ||
      roomType.maxChildren < input.children ||
      roomType.maxOccupancy < input.adults + input.children
    ) {
      return false;
    }
    const matchingRooms = await this.database.query.rooms.findMany({
      where: (row, op) =>
        op.and(
          op.eq(row.propertyId, property.id),
          op.eq(row.roomTypeId, input.roomTypeId),
          op.eq(row.status, 'ACTIVE'),
        ),
    });
    if (matchingRooms.length === 0) return false;
    const blocks = await this.database.query.roomInventoryBlocks.findMany({
      where: (row, op) =>
        op.and(
          op.eq(row.propertyId, property.id),
          op.eq(row.status, 'ACTIVE'),
          op.lt(row.startsAt, new Date(input.checkOut)),
          op.gt(row.endsAt, new Date(input.checkIn)),
        ),
    });
    const blocked = new Set(blocks.map((block) => block.roomId));
    return matchingRooms.some((room) => !blocked.has(room.id));
  }
}

export type CouponPreviewer = (input: {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly grossAmountVnd: number;
  readonly couponCode?: string;
}) => Promise<number>;

export const RECOMMENDATION_VALIDATION_SCHEMA = createQuoteRequestSchema;

export function parseRecommendationRequest(input: unknown): RecommendationRequest {
  return createQuoteRequestSchema.parse(input);
}
