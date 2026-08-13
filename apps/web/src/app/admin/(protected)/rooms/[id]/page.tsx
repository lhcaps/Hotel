import { RoomDetailAdmin } from '../../../../../components/room-detail-admin';

export default async function Room({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <RoomDetailAdmin id={id} />;
}
