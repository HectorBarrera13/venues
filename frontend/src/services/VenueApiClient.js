class VenueApiClient {
  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async getVenues({ signal } = {}) {
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues`, {
        headers: { Accept: 'application/json' },
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }

    if (!response.ok) {
      throw new Error('No pudimos cargar tus recintos en este momento.')
    }

    const venues = await response.json().catch(() => {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    })

    if (!Array.isArray(venues)) {
      throw new Error('El servidor no devolvió una lista de recintos válida.')
    }
    return venues
  }
}

const venueApiClient = new VenueApiClient()
export { VenueApiClient }
export default venueApiClient
