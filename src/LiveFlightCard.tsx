import type { LiveFlight } from "./domain";

export function LiveFlightCard({ flight }: { flight: LiveFlight }) {
  const { aircraft } = flight;
  return (
    <article className="panel">
      <div className="row">
        <h3>
          {flight.number} · {flight.origin} → {flight.destination}
        </h3>
        <span className="badge">{flight.status}</span>
      </div>
      <p>
        Departs {new Date(flight.departure).toLocaleString()} · Arrives{" "}
        {new Date(flight.arrival).toLocaleString()}
      </p>
      {(aircraft.model || aircraft.aircraft_icao) && (
        <p>
          Aircraft: {aircraft.model || aircraft.aircraft_icao}
          {aircraft.reg_number ? ` · ${aircraft.reg_number}` : ""}
        </p>
      )}
      <small>
        AirLabs
        {flight.signal_at
          ? ` · Last aircraft signal ${new Date(flight.signal_at).toLocaleString()}`
          : ""}
      </small>
    </article>
  );
}
