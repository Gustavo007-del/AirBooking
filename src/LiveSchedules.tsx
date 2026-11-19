import { useEffect, useState } from "react";
import { errorMessage, service } from "./api";
import { ErrorState, Loading } from "./components";
import type { LiveFlight } from "./domain";
import { LiveFlightCard } from "./LiveFlightCard";

export function LiveSchedules({
  origin,
  destination,
  departure,
}: {
  origin: string;
  destination: string;
  departure: string;
}) {
  const [open, setOpen] = useState(false);
  const [upcoming, setUpcoming] = useState(false);
  const [data, setData] = useState<{
    configured: boolean;
    outside_window: boolean;
    results: LiveFlight[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(undefined);
    setError("");
    service
      .liveSchedule({ origin, destination, departure }, upcoming)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [open, origin, destination, departure, upcoming]);
  return (
    <details
      className="panel"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Check live airline schedules</summary>
      {open &&
        (error ? (
          <ErrorState message={error} />
        ) : !data ? (
          <Loading />
        ) : !data.configured ? (
          <p>The live schedule feed hasn’t been configured.</p>
        ) : (
          <>
            <p>
              AirLabs shows departures up to 10 hours ahead. These flights are
              shown for information only.
            </p>
            {data.outside_window ? (
              <p>
                Your selected date ({departure} UTC) is outside the live
                schedule window.
              </p>
            ) : data.results.length ? (
              data.results.map((flight) => (
                <LiveFlightCard
                  key={flight.number + flight.departure}
                  flight={flight}
                />
              ))
            ) : (
              <p>
                {upcoming
                  ? `AirLabs reported no ${origin} → ${destination} departures in the next 10 hours.`
                  : `AirLabs reported no ${origin} → ${destination} departures for the selected date within its live window.`}
              </p>
            )}
            <button
              type="button"
              className="button outline"
              onClick={() => setUpcoming(!upcoming)}
            >
              {upcoming ? "Use selected travel date" : "Show next 10 hours"}
            </button>
          </>
        ))}
    </details>
  );
}
