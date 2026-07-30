'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BedDouble,
  Clock3,
  Coffee,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import type { PublicRoomCatalogResponse } from '@room/contracts/public-room-catalog';

import { publicHospitalityContent } from '../content/public-hospitality-content';
import { translate } from '../lib/i18n/messages';
import { publicRoomImage } from '../lib/public-room-catalog';
import { LandingAvailabilitySearch } from './landing-availability-search';
import { useLocale } from './locale-provider';

type LandingRoom = {
  id: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  amenities: readonly { name: string }[];
};

function fallbackRooms(locale: 'vi' | 'en'): readonly LandingRoom[] {
  return publicHospitalityContent.rooms.map((room, index) => ({
    id: room.key,
    name: translate(locale, `landing.room.${room.key}` as never),
    description: translate(locale, `landing.room.${room.key}.description` as never),
    maxOccupancy: index === 1 ? 4 : 2,
    amenities: [],
  }));
}

export function PublicLanding({
  catalog = null,
}: Readonly<{ catalog?: PublicRoomCatalogResponse | null }>) {
  const locale = useLocale();
  const catalogRooms = catalog?.items ?? [];
  const usesCatalog = catalogRooms.length > 0;
  const rooms = usesCatalog ? catalogRooms : fallbackRooms(locale);

  return (
    <main id="main-content">
      <section className="hospitality-hero" aria-labelledby="landing-heading">
        <img alt="" className="hospitality-hero__image" src={publicHospitalityContent.heroImage} />
        <div className="hospitality-hero__shade" />
        <div className="hospitality-hero__content">
          <p className="hospitality-hero__kicker">Room Management</p>
          <h1 id="landing-heading">{translate(locale, 'landing.heading')}</h1>
          <p>{translate(locale, 'landing.description')}</p>
          <Link className="hospitality-hero__browse" href="/rooms">
            {translate(locale, 'landing.exploreRooms')} <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>

      <section
        className="hospitality-booking"
        id="booking"
        aria-label={translate(locale, 'search.heading')}
      >
        <LandingAvailabilitySearch />
      </section>

      <section className="hospitality-trust" aria-label={translate(locale, 'landing.trustHeading')}>
        <div>
          <Clock3 aria-hidden="true" />
          <p>{translate(locale, 'landing.trust.flexible')}</p>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" />
          <p>{translate(locale, 'landing.trust.secure')}</p>
        </div>
        <div>
          <Sparkles aria-hidden="true" />
          <p>{translate(locale, 'landing.trust.support')}</p>
        </div>
      </section>

      <section
        className="hospitality-section hospitality-section--rooms"
        aria-labelledby="featured-rooms-heading"
      >
        <div className="hospitality-section__heading">
          <div>
            <p>{translate(locale, 'landing.roomsKicker')}</p>
            <h2 id="featured-rooms-heading">{translate(locale, 'landing.roomsHeading')}</h2>
          </div>
          <Link href="/rooms">
            {translate(locale, 'landing.exploreRooms')} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="hospitality-rooms">
          {rooms.slice(0, 3).map((room) => (
            <article className="hospitality-room" key={room.id}>
              <img alt={room.name} src={publicRoomImage(room.id)} />
              <div className="hospitality-room__body">
                <div className="hospitality-room__title-row">
                  <h3>{room.name}</h3>
                  <span>
                    <Users aria-hidden="true" size={15} />
                    {translate(locale, 'search.capacity', { count: room.maxOccupancy })}
                  </span>
                </div>
                {room.description === null ? null : <p>{room.description}</p>}
                {room.amenities.length > 0 ? (
                  <ul aria-label={translate(locale, 'catalog.amenities')}>
                    {room.amenities.slice(0, 3).map((amenity) => (
                      <li key={amenity.name}>{amenity.name}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href={usesCatalog ? `/rooms/${room.id}` : '/rooms'}>
                  {translate(locale, 'catalog.detailHeading')}{' '}
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="hospitality-section hospitality-section--modes"
        aria-labelledby="stay-heading"
      >
        <div className="hospitality-section__intro">
          <p>{translate(locale, 'landing.stayKicker')}</p>
          <h2 id="stay-heading">{translate(locale, 'landing.stayHeading')}</h2>
          <p>{translate(locale, 'landing.stayDescription')}</p>
        </div>
        <div className="hospitality-mode-list">
          <article>
            <Clock3 aria-hidden="true" />
            <div>
              <strong>{translate(locale, 'landing.hourlyTitle')}</strong>
              <p>{translate(locale, 'landing.hourlyDescription')}</p>
              <span>{translate(locale, 'landing.hourlyOptions')}</span>
            </div>
          </article>
          <article>
            <BedDouble aria-hidden="true" />
            <div>
              <strong>{translate(locale, 'landing.overnightTitle')}</strong>
              <p>{translate(locale, 'landing.overnightDescription')}</p>
              <span>{translate(locale, 'landing.overnightOptions')}</span>
            </div>
          </article>
        </div>
      </section>

      <section
        className="hospitality-section hospitality-section--offers"
        id="offers"
        aria-labelledby="offers-heading"
      >
        <div>
          <p>{translate(locale, 'landing.offerKicker')}</p>
          <h2 id="offers-heading">{translate(locale, 'landing.offerHeading')}</h2>
          <p>{translate(locale, 'landing.offerDescription')}</p>
        </div>
        <ul className="hospitality-plan-list">
          <li>{translate(locale, 'landing.planThreeHours')}</li>
          <li>{translate(locale, 'landing.planFiveHours')}</li>
          <li>{translate(locale, 'landing.planMidday')}</li>
          <li>{translate(locale, 'landing.planEvening')}</li>
          <li>{translate(locale, 'landing.planOvernight')}</li>
          <li>{translate(locale, 'landing.planAllDay')}</li>
        </ul>
      </section>

      <section className="hospitality-story" id="about" aria-labelledby="story-heading">
        <img alt="" src={publicHospitalityContent.rooms[1].image} />
        <div>
          <p>{translate(locale, 'public.about')}</p>
          <h2 id="story-heading">{translate(locale, 'landing.storyHeading')}</h2>
          <p>{translate(locale, 'landing.storyDescription')}</p>
          <ul>
            <li>
              <Coffee aria-hidden="true" />
              {translate(locale, 'landing.amenity.comfort')}
            </li>
            <li>
              <Clock3 aria-hidden="true" />
              {translate(locale, 'landing.amenity.flexibility')}
            </li>
            <li>
              <ShieldCheck aria-hidden="true" />
              {translate(locale, 'landing.amenity.privacy')}
            </li>
          </ul>
        </div>
      </section>

      <section className="hospitality-contact" id="contact" aria-labelledby="contact-heading">
        <div>
          <MapPin aria-hidden="true" />
          <div>
            <p>{translate(locale, 'public.contact')}</p>
            <h2 id="contact-heading">{translate(locale, 'landing.contactHeading')}</h2>
            <p>{translate(locale, 'landing.contactDescription')}</p>
          </div>
        </div>
        <Link className="hospitality-button" href="/booking/manage">
          {translate(locale, 'public.guestAccess')}
        </Link>
      </section>

      <footer className="hospitality-footer">
        <div>
          <strong>Room Management</strong>
          <p>{translate(locale, 'landing.footerCopy')}</p>
        </div>
        <nav aria-label={translate(locale, 'public.navigation')}>
          <Link href="/#booking">{translate(locale, 'public.booking')}</Link>
          <Link href="/rooms">{translate(locale, 'public.roomsPricing')}</Link>
          <Link href="/#offers">{translate(locale, 'public.offers')}</Link>
          <Link href="/booking/manage">{translate(locale, 'public.guestAccess')}</Link>
        </nav>
      </footer>
    </main>
  );
}
