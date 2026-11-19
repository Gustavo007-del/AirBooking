import axios from "axios";
import {
  type Search,
  type Flight,
  type FlightSearchSource,
  type User,
  type Booking,
  type Passenger,
  type Airport,
  type Route,
  type LiveFlight,
} from "./domain";
import { useStore } from "./store";
import type { OperationsSnapshot } from "./AdminOverview";
const baseURL = import.meta.env.VITE_API_BASE_URL || "";
export const client = axios.create({ baseURL, timeout: 15000 });
const session = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: { "X-Air-Session": "1" },
});
let access: string | null = null;
let refreshing: Promise<User | null> | null = null;
let sessionVersion = 0;

export function restoreSession(): Promise<User | null> {
  const version = sessionVersion;
  refreshing ??= session
    .post<{ access: string; user: User }>("/api/auth/session/")
    .then(({ data, status }) => {
      if (version !== sessionVersion || status === 204) return null;
      access = data.access;
      return data.user;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

client.interceptors.request.use((config) => {
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});
client.interceptors.response.use(undefined, async (error) => {
  const req = error.config;
  if (error.response?.status === 401 && access && req && !req._retry) {
    req._retry = true;
    const user = await restoreSession();
    if (user) return client(req);
    access = null;
    useStore.getState().setUser(null);
  }
  throw error;
});
export function logout() {
  sessionVersion++;
  access = null;
  useStore.getState().setUser(null);
  void Promise.resolve(refreshing)
    .then(() => session.delete("/api/auth/session/"))
    .catch(() => {});
}
const list = <T>(
  data:
    | T[]
    | {
        results: T[];
      },
) => (Array.isArray(data) ? data : data.results);
async function allPages<T>(
  path: string,
  params?: object,
  onSource?: (source: FlightSearchSource) => void,
): Promise<T[]> {
  const rows: T[] = [];
  let next: string | null = path;
  while (next) {
    const {
      data,
    }: {
      data:
        | T[]
        | {
            results: T[];
            next: string | null;
            source?: FlightSearchSource;
          };
    } = await client.get(next, { params });
    rows.push(...list(data));
    if (next === path && !Array.isArray(data) && data.source)
      onSource?.(data.source);
    const link: string | null = Array.isArray(data) ? null : data.next;
    // Use only the API path; never forward bearer credentials to a different host.
    if (link) {
      const url: URL = new URL(link, window.location.origin);
      next = url.pathname + url.search;
    } else next = null;
    params = undefined;
  }
  return rows;
}
const managedFlights = new Map<string, Flight>();
export const service = {
  async airportSuggestions(search: string) {
    const { data } = await client.get<{ results: Airport[] }>(
      "/api/airports/",
      { params: { search, page_size: 20 } },
    );
    return data.results;
  },
  async liveFlight(number: string) {
    return (
      await client.get<LiveFlight>("/api/flights/live-status/", {
        params: { number },
      })
    ).data;
  },
  async liveSchedule(
    search: Pick<Search, "origin" | "destination" | "departure">,
    upcoming = false,
  ) {
    const { origin, destination, departure } = search;
    return (
      await client.get<{
        configured: boolean;
        outside_window: boolean;
        results: LiveFlight[];
      }>("/api/flights/schedules/", {
        params: { origin, destination, departure, upcoming },
      })
    ).data;
  },
  async updateBooking(id: string, passengers: Passenger[], admin = false) {
    return (
      await client.patch<Booking>(
        `/api/${admin ? "admin/" : ""}bookings/${id}/`,
        { passengers },
      )
    ).data;
  },
  async operations(): Promise<OperationsSnapshot> {
    return (await client.get<OperationsSnapshot>("/api/admin/operations/"))
      .data;
  },
  async updateCustomer(
    id: string,
    data: { name: string; phone: string; is_active: boolean },
  ) {
    return (await client.patch<User>(`/api/admin/users/${id}/`, data)).data;
  },
  async cancelBooking(id: string, admin = false) {
    return (
      await client.post<Booking>(
        `/api/${admin ? "admin/" : ""}bookings/${id}/cancel/`,
      )
    ).data;
  },
  airports(admin = false) {
    return allPages<Airport>(
      admin ? "/api/admin/airports/" : "/api/airports/",
      { page_size: 100 },
    );
  },
  routes(admin = false) {
    return allPages<Route>(admin ? "/api/admin/routes/" : "/api/routes/");
  },
  destinations() {
    return allPages<Airport>("/api/destinations/");
  },
  async saveAirport(id: number | undefined, data: Partial<Airport>) {
    if (id) await client.patch(`/api/admin/airports/${id}/`, data);
    else await client.post("/api/admin/airports/", data);
  },
  async saveRoute(id: number | undefined, data: Partial<Route>) {
    if (id) await client.patch(`/api/admin/routes/${id}/`, data);
    else await client.post("/api/admin/routes/", data);
  },
  async search(s: Search) {
    let source: FlightSearchSource = "database";
    const flights = await allPages<Flight>(
      "/api/flights/search/",
      { ...s, page_size: 100 },
      (value) => {
        source = value;
      },
    );
    return { flights, source };
  },
  async flight(id: string): Promise<Flight> {
    return (
      await client.get(`/api/flights/${encodeURIComponent(id)}/`, {
        params: { cabin: useStore.getState().search.cabin },
      })
    ).data;
  },
  async login(email: string, password: string): Promise<User> {
    const r = (await session.post("/api/auth/login/", { email, password }))
      .data;
    access = r.access;

    return r.user;
  },
  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    return (await client.post("/api/auth/register/", data)).data;
  },
  async users(): Promise<User[]> {
    return allPages<User>("/api/admin/users/");
  },
  async approve(id: string): Promise<void> {
    await client.post(`/api/admin/users/${id}/approve/`);
    return;
  },
  async reject(id: string): Promise<void> {
    await client.post(`/api/admin/users/${id}/reject/`);
    return;
  },
  async bookings(admin = false, filters?: object): Promise<Booking[]> {
    return allPages<Booking>(
      admin ? "/api/admin/bookings/" : "/api/bookings/",
      filters,
    );
  },
  async booking(id: string, admin = false): Promise<Booking> {
    return (
      await client.get(
        `${admin ? "/api/admin/bookings/" : "/api/bookings/"}${id}/`,
      )
    ).data;
  },
  async book(
    flights: Flight[],
    passengers: Passenger[],
    key: string,
  ): Promise<Booking> {
    const user = useStore.getState().user;
    if (!user || user.status !== "approved")
      throw Error("An approved account is required");
    const reservation: Booking = (
      await client.post(
        "/api/bookings/",
        {
          flight_ids: flights.map((f) => f.id),
          passengers,
          cabin: useStore.getState().search.cabin,
        },
        { headers: { "Idempotency-Key": key } },
      )
    ).data;
    // Retrying reuses both the reservation and its one-to-one simulated payment.
    if (reservation.status === "Confirmed") return reservation;
    if (reservation.status === "Cancelled")
      throw Error(
        "This reservation expired or was cancelled. Start a new booking.",
      );
    return (
      await client.post(`/api/bookings/${reservation.id}/payment/`, {
        outcome: "success",
      })
    ).data;
  },
  async adminFlights(): Promise<Flight[]> {
    const rows = await allPages<Flight>("/api/admin/flights/", {
      page_size: 100,
    });
    managedFlights.clear();
    rows.forEach((flight) => managedFlights.set(flight.id, flight));
    return rows;
  },
  adminRouteFlights(route: number) {
    return allPages<Flight>("/api/admin/flights/", { route, page_size: 100 });
  },
  async saveFlight(f: Flight): Promise<void> {
    const original = managedFlights.get(f.id);
    const departure = new Date(`${f.date}T${f.departure}:00Z`);
    const arrival = new Date(`${f.date}T${f.arrival}:00Z`);
    arrival.setUTCDate(
      arrival.getUTCDate() + (f.arrivalDay || (arrival <= departure ? 1 : 0)),
    );
    const payload = {
      number: f.number,
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      route: f.route,
      departure_datetime:
        original?.date === f.date && original.departure === f.departure
          ? (original.departure_datetime ?? departure.toISOString())
          : departure.toISOString(),
      arrival_datetime:
        original?.date === f.date &&
        original.arrival === f.arrival &&
        original.arrivalDay === f.arrivalDay
          ? (original.arrival_datetime ?? arrival.toISOString())
          : arrival.toISOString(),
      price: String(f.price),
      currency: f.currency || "INR",
      stops: f.stops,
      status: f.status,
      total_seats:
        (original?.total_seats ?? original?.seats ?? 0) +
        f.seats -
        (original?.seats ?? 0),
    };
    if (original) await client.put(`/api/admin/flights/${f.id}/`, payload);
    else await client.post("/api/admin/flights/", payload);
    return;
  },
  async status(id: string, status: Flight["status"]): Promise<void> {
    await client.put(`/api/admin/flights/${id}/status/`, { status });
    return;
  },
  async profile(name: string): Promise<User> {
    return (await client.patch("/api/auth/me/", { name })).data;
  },
};
export { errorMessage, fieldErrors } from "./feedback";
