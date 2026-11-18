import Venue, { type VenueProps } from '../../src/entities/Venue';

/** Valid `POST /venues` body. */
export const validVenuePayload = {
  name: 'Foro Indie',
  description: 'Indie venue',
  address: 'Calle Colima 123, Roma Norte',
  city: 'Ciudad de Mexico',
  country: 'MX',
  location: { lat: 19.4194, lng: -99.1617 },
};

export function buildVenue(overrides: Partial<VenueProps> = {}): Venue {
  return new Venue({
    id: 'venue-1',
    name: 'Auditorio Nacional',
    description: 'Concert hall',
    address: 'Paseo de la Reforma 50',
    city: 'Ciudad de Mexico',
    country: 'MX',
    location: { lat: 19.4245, lng: -99.1951 },
    ownerId: 'owner-1',
    createdAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  });
}
