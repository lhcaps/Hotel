import { publicRoomCatalogResponseSchema } from '@room/contracts';

export interface PublicRoomCatalogRepositoryPort {
  list(): Promise<
    readonly {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly maxAdults: number;
      readonly maxChildren: number;
      readonly maxOccupancy: number;
      readonly amenities: readonly { readonly name: string }[];
    }[]
  >;
}

export class PublicRoomCatalogService {
  public constructor(private readonly repository: PublicRoomCatalogRepositoryPort) {}

  public async list() {
    return publicRoomCatalogResponseSchema.parse({ items: await this.repository.list() });
  }
}
