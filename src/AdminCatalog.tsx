import { useEffect, useState, type FormEvent } from "react";
import type { Airport, Flight, Route } from "./domain";
import { service, errorMessage } from "./api";
import { refreshAirports } from "./catalog";
import { Notice } from "./Notice";

type Props = {
  kind: "Airports" | "Routes";
  airports: Airport[];
  routes: Route[];
  reload: () => Promise<void>;
};

export function AdminCatalog({ kind, airports, routes, reload }: Props) {
  const [editing, setEditing] = useState<Airport | Route | null>();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [routeFlights, setRouteFlights] = useState<Route>();
  const [flightRows, setFlightRows] = useState<Flight[]>();
  const [flightError, setFlightError] = useState("");
  const [requestedPage, setPage] = useState(1);
  useEffect(() => {
    if (!routeFlights) return;
    let active = true;
    service.adminRouteFlights(routeFlights.id).then(
      (flights) => {
        if (active) setFlightRows(flights);
      },
      (failure) => {
        if (active) setFlightError(errorMessage(failure));
      },
    );
    return () => {
      active = false;
    };
  }, [routeFlights]);
  const isAirport = kind === "Airports";
  const airport = editing && "code" in editing ? editing : null;
  const route = editing && "origin" in editing ? editing : null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? "").trim();
    try {
      if (isAirport) {
        await service.saveAirport(airport?.id, {
          code: value("code").toUpperCase(),
          name: value("name"),
          city: value("city"),
          country: value("country"),
          region: value("region"),
          timezone: value("timezone"),
          latitude: value("latitude") || null,
          longitude: value("longitude") || null,
          active: values.has("active"),
        });
      } else {
        await service.saveRoute(route?.id, {
          origin: Number(value("origin")),
          destination: Number(value("destination")),
          distance_km: value("distance") ? Number(value("distance")) : null,
          duration_minutes: value("duration")
            ? Number(value("duration"))
            : null,
          active: values.has("active"),
        });
      }
      refreshAirports();
      await reload();
      setEditing(undefined);
      setNotice(isAirport ? "Airport saved." : "Route saved.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const rows = (isAirport ? airports : routes).filter((record) =>
    JSON.stringify(record).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  return (
    <section>
      <div className="row">
        <label>
          Search {kind.toLowerCase()}
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            setError("");
          }}
        >
          Add {isAirport ? "airport" : "route"}
        </button>
      </div>
      {notice && (
        <Notice
          tone="success"
          message={notice}
          onDismiss={() => setNotice("")}
        />
      )}
      {editing !== undefined && (
        <form className="panel" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>
            {editing ? "Edit" : "Add"} {isAirport ? "airport" : "route"}
          </h2>
          {error && <Notice message={error} />}
          <div className="form-grid">
            {isAirport ? (
              <>
                <label>
                  IATA code
                  <input
                    name="code"
                    defaultValue={airport?.code}
                    required
                    pattern="[a-zA-Z]{3}"
                    readOnly={!!airport}
                  />
                </label>
                <label>
                  Airport name
                  <input
                    name="name"
                    defaultValue={airport?.name}
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  City
                  <input
                    name="city"
                    defaultValue={airport?.city}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Country
                  <input
                    name="country"
                    defaultValue={airport?.country}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  State or region
                  <input
                    name="region"
                    defaultValue={airport?.region}
                    maxLength={120}
                  />
                </label>
                <label>
                  Time zone
                  <input
                    name="timezone"
                    defaultValue={airport?.timezone ?? "UTC"}
                    required
                  />
                </label>
                <label>
                  Latitude
                  <input
                    name="latitude"
                    type="number"
                    min="-90"
                    max="90"
                    step="0.00001"
                    defaultValue={airport?.latitude ?? ""}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    name="longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.00001"
                    defaultValue={airport?.longitude ?? ""}
                  />
                </label>
              </>
            ) : (
              <>
                {(["origin", "destination"] as const).map((side) => (
                  <label key={side}>
                    {side === "origin"
                      ? "Origin airport"
                      : "Destination airport"}
                    <select
                      name={side}
                      required
                      defaultValue={route?.[side] ?? ""}
                    >
                      <option value="">Select an airport</option>
                      {airports.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.city}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  Distance (km)
                  <input
                    type="number"
                    name="distance"
                    min="1"
                    defaultValue={route?.distance_km ?? ""}
                  />
                </label>
                <label>
                  Typical duration (minutes)
                  <input
                    type="number"
                    name="duration"
                    min="1"
                    defaultValue={route?.duration_minutes ?? ""}
                  />
                </label>
              </>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />{" "}
            Active
          </label>
          <div className="actions">
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => setEditing(undefined)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{isAirport ? "Airport" : "Route"}</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice((page - 1) * pageSize, page * pageSize)
                .map((record) => (
                  <tr key={record.id}>
                    <td>
                      {"code" in record
                        ? `${record.code} · ${record.name}, ${record.city}`
                        : `${record.origin_detail.code} → ${record.destination_detail.code}`}
                    </td>
                    <td>{record.active ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setEditing(record);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                      {"origin_detail" in record && (
                        <button
                          className="text-link"
                          onClick={() => {
                            if (routeFlights?.id === record.id) return;
                            setFlightRows(undefined);
                            setFlightError("");
                            setRouteFlights(record);
                          }}
                        >
                          View flights
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No matching {kind.toLowerCase()}.</p>
      )}
      {pageCount > 1 && (
        <div className="actions admin-pages">
          <button
            className="button outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            className="button outline"
            disabled={page === pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      {routeFlights && (
        <div className="panel">
          <div className="row">
            <h2>
              {routeFlights.origin_detail.code} →{" "}
              {routeFlights.destination_detail.code}
            </h2>
            <button
              className="text-link"
              onClick={() => setRouteFlights(undefined)}
            >
              Close
            </button>
          </div>
          {flightError ? (
            <Notice message={flightError} />
          ) : !flightRows ? (
            <p role="status">Loading flights…</p>
          ) : flightRows.length ? (
            <ul>
              {flightRows.map((flight) => (
                <li key={flight.id}>
                  {flight.number} · {flight.date} {flight.departure} UTC ·{" "}
                  {flight.status}
                </li>
              ))}
            </ul>
          ) : (
            <p>No flights assigned to this route.</p>
          )}
        </div>
      )}
    </section>
  );
}
