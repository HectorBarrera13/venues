// src/features/venues/hooks/useCreateVenue.js
//
// Exposes loading/error/success state around VenueApiClient.createVenue,
// so VenueRegisterForm doesn't have to manage fetch state itself.

import { useState, useCallback } from "react";
import venueApiClient from "../services/VenueApiClient.js";

const client = venueApiClient;

export function useCreateVenue() {
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [venue, setVenue] = useState(null);

  const createVenue = useCallback(async (data) => {
    setStatus("loading");
    setError(null);

    try {
      const created = await client.createVenue(data);
      setVenue(created);
      setStatus("success");
      return created;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError({ message, status: err.status ?? 500 });
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setVenue(null);
  }, []);

  return {
    createVenue,
    reset,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    error,
    venue,
  };
}
