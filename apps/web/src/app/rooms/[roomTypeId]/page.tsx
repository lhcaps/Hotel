import Link from 'next/link';
import { cookies } from 'next/headers';
import { resolveLocale, translate } from '../../../lib/i18n/messages';
import { RoomDetailQuoteAction } from '../../../components/room-detail-quote-action';
import { loadPublicRoomType, publicRoomImage } from '../../../lib/public-room-catalog';

export default async function PublicRoomDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ roomTypeId }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const room = await loadPublicRoomType(roomTypeId);
  const locale = resolveLocale(cookieStore.get('room_locale')?.value);
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
  return (
    <main className="rooms-catalog" id="main-content">
      <Link href={search.size > 0 ? `/booking/search?${search.toString()}` : '/rooms'}>
        {translate(locale, 'catalog.backToResults')}
      </Link>
      {room === null ? (
        <p className="rooms-catalog__status" role="alert">
          {translate(locale, 'search.loadErrorHelp')}
        </p>
      ) : (
        <section className="room-detail">
          <img alt={room.name} src={publicRoomImage(room.id)} />
          <div>
            <p>{translate(locale, 'public.roomsPricing')}</p>
            <h1>{room.name}</h1>
            {room.description === null ? null : <p>{room.description}</p>}
            <p className="room-detail__capacity">
              {translate(locale, 'search.capacity', { count: room.maxOccupancy })}
            </p>
            <h2>{translate(locale, 'catalog.amenities')}</h2>
            {room.amenities.length > 0 ? (
              <ul className="room-detail__amenities">
                {room.amenities.map((amenity) => (
                  <li key={amenity.name}>{amenity.name}</li>
                ))}
              </ul>
            ) : (
              <p>{translate(locale, 'catalog.amenitiesHelp')}</p>
            )}
            <p className="rooms-catalog__status">{translate(locale, 'catalog.statusPrompt')}</p>
            <RoomDetailQuoteAction roomTypeId={roomTypeId} search={search.toString()} />
          </div>
        </section>
      )}
    </main>
  );
}
