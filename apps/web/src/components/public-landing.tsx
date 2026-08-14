'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  Coffee,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import type { PublicRoomCatalogResponse } from '@room/contracts/public-room-catalog';
import type { PublicContact } from '@room/contracts';

import {
  peaceHomeCommonImages,
  presentPhysicalRooms,
  presentTierSummaries,
  roomStartingPrice,
} from '../content/peace-home-physical-rooms';
import { formatVnd, translate } from '../lib/i18n/messages';
import { toPublicCatalogState } from '../lib/public-catalog-state';
import { LandingAvailabilitySearch } from './landing-availability-search';
import { useLocale } from './locale-provider';

export function PublicLanding({
  catalog = null,
  contact = null,
}: Readonly<{
  catalog?: PublicRoomCatalogResponse | null;
  contact?: PublicContact | null;
}>) {
  const locale = useLocale();
  const state = toPublicCatalogState(catalog);
  const catalogRooms = state.kind === 'ready' ? presentPhysicalRooms(state.catalog) : [];
  const tierSummaries = state.kind === 'ready' ? presentTierSummaries(state.catalog) : [];
  const contactEntries = contactToEntries(contact);
  const year = new Date().getFullYear();

  return (
    <main id="main-content">
      <section className="hospitality-hero" aria-labelledby="landing-heading">
        <img alt="" className="hospitality-hero__image" src={peaceHomeCommonImages[0]} />
        <div className="hospitality-hero__shade" />
        <div className="hospitality-hero__content">
          <p className="hospitality-hero__kicker">PeaceNest</p>
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
        {tierSummaries.length > 0 ? (
          <div className="hospitality-tier-summary" data-testid="landing-tier-summary">
            {tierSummaries.map((tier) => (
              <article key={tier.code}>
                <img
                  alt={tier.name}
                  src={tier.representative.gallery[0].replace('-hero.webp', '-card.webp')}
                />
                <div>
                  <h3>{tier.name}</h3>
                  <p>{translate(locale, 'catalog.conceptCount', { count: tier.rooms.length })}</p>
                  <Link href={`/rooms?tier=${tier.code}`}>
                    {translate(locale, 'catalog.viewTier')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <div className="hospitality-section__heading">
          <div>
            <p>{translate(locale, 'landing.roomsKicker')}</p>
            <h2 id="featured-rooms-heading">{translate(locale, 'landing.roomsHeading')}</h2>
          </div>
          <Link href="/rooms">
            {translate(locale, 'landing.exploreRooms')} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        {catalogRooms.length > 0 ? (
          <div className="hospitality-rooms" data-testid="landing-featured-rooms">
            {catalogRooms.slice(0, 3).map((room) => (
              <article className="hospitality-room" key={room.slug}>
                <img
                  alt={room.roomType.name}
                  src={room.gallery[0].replace('-hero.webp', '-card.webp')}
                />
                <div className="hospitality-room__body">
                  <div className="hospitality-room__title-row">
                    <h3>{room.roomType.name}</h3>
                    <span>
                      <Users aria-hidden="true" size={15} />
                      {translate(locale, 'search.capacity', { count: room.roomType.maxOccupancy })}
                    </span>
                  </div>
                  <p>{room.roomType.priceTier?.name ?? room.roomType.name}</p>
                  {roomStartingPrice(room) !== null ? (
                    <p>
                      {translate(locale, 'catalog.fromPrice', {
                        price: formatVnd(locale, roomStartingPrice(room) ?? 0),
                      })}
                    </p>
                  ) : null}
                  {room.roomType.amenities.length > 0 ? (
                    <ul aria-label={translate(locale, 'catalog.amenities')}>
                      {room.roomType.amenities.slice(0, 3).map((amenity) => (
                        <li key={amenity.name}>{amenity.name}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Link href={`/rooms/${room.slug}`}>
                    {translate(locale, 'catalog.detailHeading')}{' '}
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section
            aria-labelledby="landing-featured-empty-heading"
            className="rooms-catalog__status"
            data-testid="landing-featured-empty"
            role={state.kind === 'unavailable' ? 'alert' : undefined}
          >
            <h2 id="landing-featured-empty-heading">
              {translate(
                locale,
                state.kind === 'unavailable'
                  ? 'catalog.unavailableHeading'
                  : 'catalog.emptyHeading',
              )}
            </h2>
            <p>
              {translate(
                locale,
                state.kind === 'unavailable' ? 'catalog.unavailableBody' : 'catalog.emptyBody',
              )}
            </p>
            <Link className="hospitality-button mt-4" href="/rooms">
              {translate(locale, 'catalog.retry')}
            </Link>
          </section>
        )}
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
        <p className="hospitality-section__offer-note">{translate(locale, 'search.emptyHelp')}</p>
      </section>

      <section className="hospitality-story" id="about" aria-labelledby="story-heading">
        <img alt="" src={peaceHomeCommonImages[1]} />
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
            {contactEntries.length === 0 ? (
              <p className="hospitality-contact__empty">
                {translate(locale, 'public.contact.empty')}
              </p>
            ) : (
              <ul className="hospitality-contact__list" data-testid="landing-public-contact">
                {contactEntries.map((entry) => (
                  <li key={`${entry.kind}-${entry.href ?? entry.label}`}>
                    {entry.kind === 'phone' ? (
                      <Phone aria-hidden="true" size={16} />
                    ) : entry.kind === 'address' ? (
                      <MapPin aria-hidden="true" size={16} />
                    ) : (
                      <ArrowRight aria-hidden="true" size={16} />
                    )}
                    {entry.href !== undefined ? (
                      <a href={entry.href} rel="noopener noreferrer" target="_blank">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{entry.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <Link className="hospitality-button" href="/booking/manage">
          {translate(locale, 'public.guestAccess')}
        </Link>
      </section>

      <footer className="hospitality-footer" data-testid="landing-footer">
        <div>
          <strong>PeaceNest</strong>
          <p>{translate(locale, 'landing.footerCopy')}</p>
          <p className="hospitality-footer__copy">
            {translate(locale, 'public.footer.copyright', { year })}
          </p>
        </div>
        <nav aria-label={translate(locale, 'public.navigation')}>
          <p>{translate(locale, 'public.footer.discover')}</p>
          <Link href="/#booking">{translate(locale, 'public.footer.discover.booking')}</Link>
          <Link href="/rooms">{translate(locale, 'public.footer.discover.rooms')}</Link>
          <Link href="/#offers">{translate(locale, 'public.footer.discover.offers')}</Link>
          <Link href="/booking/manage">{translate(locale, 'public.footer.discover.manage')}</Link>
        </nav>
        <div>
          <p>{translate(locale, 'public.footer.contactHeading')}</p>
          {contactEntries.length === 0 ? (
            <p className="hospitality-footer__empty">{translate(locale, 'public.contact.empty')}</p>
          ) : (
            <ul className="hospitality-footer__contact">
              {contactEntries.map((entry) => (
                <li key={`footer-${entry.kind}-${entry.href ?? entry.label}`}>
                  {entry.href !== undefined ? (
                    <a href={entry.href} rel="noopener noreferrer" target="_blank">
                      {entry.label}
                    </a>
                  ) : (
                    <span>{entry.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </footer>
    </main>
  );
}

interface ContactEntry {
  readonly kind: 'phone' | 'zalo' | 'address' | 'facebook';
  readonly label: string;
  readonly href: string | undefined;
}

function contactToEntries(contact: PublicContact | null): ContactEntry[] {
  if (contact === null) return [];
  const entries: ContactEntry[] = [];
  if (typeof contact.phone === 'string' && contact.phone.trim().length > 0) {
    entries.push({
      kind: 'phone',
      label: contact.phone.trim(),
      href: `tel:${contact.phone.trim()}`,
    });
  }
  if (typeof contact.zalo === 'string' && contact.zalo.trim().length > 0) {
    entries.push({
      kind: 'zalo',
      label: 'Zalo',
      href: contact.zalo.trim(),
    });
  }
  if (typeof contact.facebook === 'string' && contact.facebook.trim().length > 0) {
    entries.push({
      kind: 'facebook',
      label: 'Facebook',
      href: contact.facebook.trim(),
    });
  }
  if (typeof contact.address === 'string' && contact.address.trim().length > 0) {
    entries.push({
      kind: 'address',
      label: contact.address.trim(),
      href: undefined,
    });
  }
  return entries;
}
