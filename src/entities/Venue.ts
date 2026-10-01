import { randomUUID } from 'node:crypto';

export interface VenueProps {
  id?: string;
  name: string;
  description: string;
  location: string;
  ownerId: string;
  createdAt?: string | Date;
}

export default class Venue {
  id: string;
  name: string;
  description: string;
  location: string;
  ownerId: string;
  createdAt: string;

  constructor(props: VenueProps);
  constructor(name: string, description: string, location: string, ownerId: string);
  constructor(nameOrProps: string | VenueProps, description?: string, location?: string, ownerId?: string) {
    const props: VenueProps = typeof nameOrProps === 'string'
      ? { name: nameOrProps, description: description!, location: location!, ownerId: ownerId! }
      : nameOrProps;

    this.id = props.id || randomUUID();
    this.name = props.name;
    this.description = props.description;
    this.location = props.location;
    this.ownerId = props.ownerId;
    this.createdAt = props.createdAt instanceof Date
      ? props.createdAt.toISOString()
      : props.createdAt || new Date().toISOString();
  }

  belongsTo(userId: string | undefined): boolean {
    return Boolean(userId && this.ownerId === userId);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      location: this.location,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
    };
  }
}
