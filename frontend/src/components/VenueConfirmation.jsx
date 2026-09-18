// src/features/venues/components/VenueConfirmation.jsx
//
// Task 11: shown by VenueRegisterForm after a successful POST /venues.

export function VenueConfirmation({ venue, onRegisterAnother }) {
  return (
    <div role="status">
      <h2>Recinto registrado correctamente</h2>
      {venue && (
        <p>
          {venue.name} quedó registrado en {venue.location}.
        </p>
      )}
      <button type="button" onClick={onRegisterAnother}>
        Registrar otro recinto
      </button>
    </div>
  );
}
