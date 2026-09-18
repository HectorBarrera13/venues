import { useCallback, useRef, useState } from 'react'
import venueApiClient from '../services/VenueApiClient.js'
import useCurrentUser from './useCurrentUser.js'

/**
 * Task 10: useCreateVenue
 *
 * Wraps VenueApiClient.createVenue and exposes the loading/error/success
 * states the "Register Venue" form (Task 9) needs to render itself, plus
 * the `venue` the API returned so a success confirmation (Task 11) can
 * show it. Consumers should never read `error.message` alone to branch
 * on the failure type — `error.status` (400 vs 403) is what Task 15
 * needs to tell a validation error from a permission error.
 *
 * @returns {{
 *   createVenue: (data: { name: string, description: string, location: string }) => Promise<object | undefined>,
 *   loading: boolean,
 *   error: (Error & { status?: number }) | null,
 *   success: boolean,
 *   venue: object | null,
 *   reset: () => void,
 * }}
 */
function useCreateVenue() {
  const { currentUser } = useCurrentUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [venue, setVenue] = useState(null)
  const requestIdRef = useRef(0)

  const reset = useCallback(() => {
    requestIdRef.current += 1
    setLoading(false)
    setError(null)
    setSuccess(false)
    setVenue(null)
  }, [])

  const createVenue = useCallback(
    async (data) => {
      const requestId = (requestIdRef.current += 1)
      setLoading(true)
      setError(null)
      setSuccess(false)

      try {
        const createdVenue = await venueApiClient.createVenue(data, { currentUser })
        if (requestIdRef.current !== requestId) return undefined // superseded by a newer call or a reset()

        setVenue(createdVenue)
        setSuccess(true)
        return createdVenue
      } catch (requestError) {
        if (requestIdRef.current !== requestId) return undefined
        setError(requestError)
        setSuccess(false)
        return undefined
      } finally {
        if (requestIdRef.current === requestId) setLoading(false)
      }
    },
    [currentUser],
  )

  return { createVenue, loading, error, success, venue, reset }
}

export default useCreateVenue
