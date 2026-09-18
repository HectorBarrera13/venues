function formatDate(value) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date)
}

function VenueCard({ venue }) {
  return (
    <article className="venue-card">
      <div className="venue-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3>{venue.name || 'Recinto sin nombre'}</h3>
      <p className="venue-location">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        {venue.location || 'Ubicación por confirmar'}
      </p>
      <p className="venue-description">
        {venue.description || 'Este recinto todavía no tiene una descripción.'}
      </p>
      <footer className="venue-card-footer">
        <span className="venue-status">Registrado</span>
        <time dateTime={venue.createdAt || undefined}>{formatDate(venue.createdAt)}</time>
      </footer>
    </article>
  )
}

export default VenueCard
