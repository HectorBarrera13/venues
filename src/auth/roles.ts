export const Roles = {
  VENUE_OWNER: 'VENUE_OWNER',
  ORGANIZER: 'ORGANIZER',
  FAN: 'FAN',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
