/**
 * An immutable seat-map snapshot: one `MapVersion` per save of a venue
 * (docs/map-format.md section 4.1). Versions are created and read, never
 * updated or deleted, and the seat ids of version `n` always identify the
 * same physical seat of version `n` (VEN-206).
 */
import type { MapPayload, Seat, Stage, Zone } from '../maps/mapFormat';

export interface MapVersionProps extends MapPayload {
  venueId: string;
  version: number;
  createdAt: string | Date;
}

export interface MapVersionJSON {
  venueId: string;
  version: number;
  createdAt: string;
  stage: Stage | null;
  zones: Zone[];
  seats: Seat[];
}

export class MapVersion {
  readonly venueId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly stage: Stage | null;
  readonly zones: Zone[];
  readonly seats: Seat[];

  constructor(props: MapVersionProps) {
    this.venueId = props.venueId;
    this.version = props.version;
    this.createdAt = props.createdAt instanceof Date ? props.createdAt.toISOString() : props.createdAt;
    this.stage = props.stage ?? null;
    this.zones = props.zones;
    this.seats = props.seats;
  }

  toJSON(): MapVersionJSON {
    return {
      venueId: this.venueId,
      version: this.version,
      createdAt: this.createdAt,
      stage: this.stage,
      zones: this.zones,
      seats: this.seats,
    };
  }
}

export default MapVersion;
