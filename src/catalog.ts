import { useEffect, useState } from "react";
import { errorMessage, service } from "./api";
import type { Airport } from "./domain";

const requests: Partial<
  Record<"airports" | "destinations", Promise<Airport[]>>
> = {};
export const refreshAirports = () => {
  delete requests.airports;
  delete requests.destinations;
};

export function useAirports(kind: "airports" | "destinations" = "airports") {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    requests[kind] ??= (
      kind === "airports" ? service.airports() : service.destinations()
    ).catch((failure) => {
      delete requests[kind];
      throw failure;
    });
    requests[kind]
      .then((rows) => {
        if (active) setAirports(rows);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, kind]);
  return {
    airports,
    error,
    loading,
    retry: () => setAttempt((value) => value + 1),
  };
}
