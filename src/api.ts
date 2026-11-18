import axios from "axios";
import {
  DEMO,
  type Search,
  type Flight,
  type User,
  type Booking,
  type Passenger,
  defaultSearch,
} from "./domain";
import { useStore } from "./store";
const baseURL = import.meta.env.VITE_API_BASE_URL || "";
export const client = axios.create({ baseURL, timeout: 15000 });
let access: string | null = null,
  refresh: string | null = null;
let refreshing: Promise<string> | null = null;
client.interceptors.request.use((config) => {
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});
client.interceptors.response.use(
  (r) => r,
  async (error) => {
    const req = error.config;
    if (error.response?.status === 401 && refresh && !req._retry) {
      req._retry = true;
      try {
        refreshing ??= axios
          .post(baseURL + "/api/auth/token/refresh/", { refresh })
          .then((r) => {
            access = r.data.access;
            if (r.data.refresh) refresh = r.data.refresh;
            return access!;
          })
          .finally(() => {
            refreshing = null;
          });
        await refreshing;
        return client(req);
      } catch {
        logout();
      }
    }
    throw error;
  },
);
export function logout() {
  access = null;
  refresh = null;
  useStore.getState().setUser(null);
}
const read = <T>(key: string, fallback: T): T => {
  try {
    return (
      JSON.parse(localStorage.getItem("aere-demo-" + key) || "null") ?? fallback
    );
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) =>
  localStorage.setItem("aere-demo-" + key, JSON.stringify(v));
const delay = () => new Promise((r) => setTimeout(r, 350));
const list = <T>(data: T[] | { results: T[] }) =>
  Array.isArray(data) ? data : data.results;
const seedUsers: User[] = [
  {
    id: "review-1",
    name: "Alex Morgan",
    email: "alex@example.com",
    role: "user",
    status: "pending",
  },
  {
    id: "review-2",
    name: "Sam Rivera",
    email: "sam@example.com",
    role: "user",
    status: "pending",
  },
];
export function mockFlights(s: Search): Flight[] {
  return [0, 1, 2, 3, 4].map((i) => ({
    id: `${s.origin}-${s.destination}-${s.departure}-${i}`,
    number: `AE ${201 + i * 32}`,
    airline: "AERÉ Demonstration",
    origin: s.origin,
    destination: s.destination,
    date: s.departure,
    departure: ["06:30", "09:45", "14:20", "18:10", "22:45"][i],
    arrival: ["12:20", "15:05", "22:10", "23:45", "06:20"][i],
    arrivalDay: i === 4 ? 1 : 0,
    duration: [530, 500, 650, 515, 575][i],
    stops: i === 2 ? 1 : 0,
    price:
      [38600, 42900, 32400, 45800, 35900][i] *
      (s.cabin === "Business" ? 2.8 : s.cabin === "Premium economy" ? 1.5 : 1),
    seats: [8, 4, 16, 3, 12][i],
    status: "On time",
  }));
}
export const service = {
  async search(s: Search): Promise<Flight[]> {
    if (!DEMO)
      return list(
        (await client.get("/api/flights/search/", { params: s })).data,
      );
    await delay();
    const edits = read<Flight[]>("flights", []);
    return mockFlights(s)
      .map((f) => edits.find((e) => e.id === f.id) || f)
      .concat(
        edits.filter(
          (f) =>
            f.origin === s.origin &&
            f.destination === s.destination &&
            f.date === s.departure &&
            !f.id.startsWith(`${s.origin}-${s.destination}`),
        ),
      );
  },
  async flight(id: string): Promise<Flight> {
    if (!DEMO)
      return (await client.get(`/api/flights/${encodeURIComponent(id)}/`)).data;
    const custom = read<Flight[]>("flights", []).find((f) => f.id === id);
    if (custom) return custom;
    const p = id.split("-");
    const s = {
      ...useStore.getState().search,
      origin: p[0],
      destination: p[1],
      departure: p.slice(2, 5).join("-"),
    };
    const found = mockFlights(s).find((f) => f.id === id);
    if (!found) throw Error("Flight not found");
    return found;
  },
  async login(email: string, password: string): Promise<User> {
    if (DEMO)
      throw Error(
        "Use a labelled demo session below. Real sign-in requires a connected API.",
      );
    const r = (await client.post("/api/auth/login/", { email, password })).data;
    access = r.access;
    refresh = r.refresh;
    return r.user;
  },
  async demoLogin(role: "user" | "admin"): Promise<User> {
    if (!DEMO) throw Error("Demo sessions are disabled");
    await delay();
    return {
      id: role === "admin" ? "demo-admin" : "demo-traveller",
      name: role === "admin" ? "Demo Administrator" : "Demo Traveller",
      email: `${role}@example.com`,
      role,
      status: "approved",
    };
  },
  async demoResume(email: string): Promise<User> {
    if (!DEMO) throw Error("Demo sessions are disabled");
    const u = (await this.users()).find((u) => u.email === email);
    if (!u) throw Error("No demo registration found for this email.");
    return u;
  },
  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    if (!DEMO) return (await client.post("/api/auth/register/", data)).data;
    await delay();
    const users = read<User[]>("users", seedUsers);
    if (users.some((u) => u.email === data.email))
      throw Error("This email is already registered in this demo");
    const u: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      role: "user",
      status: "pending",
    };
    write("users", [...users, u]);
    return u;
  },
  async users(): Promise<User[]> {
    return DEMO
      ? read("users", seedUsers)
      : list((await client.get("/api/admin/users/pending/")).data);
  },
  async approve(id: string): Promise<void> {
    if (!DEMO) {
      await client.post(`/api/admin/users/${id}/approve/`);
      return;
    }
    write(
      "users",
      (await this.users()).map((u) =>
        u.id === id ? { ...u, status: "approved" } : u,
      ),
    );
  },
  async reject(id: string): Promise<void> {
    if (!DEMO)
      throw Error(
        "User rejection endpoint is not configured in the backend contract.",
      );
    write(
      "users",
      (await this.users()).map((u) =>
        u.id === id ? { ...u, status: "rejected" } : u,
      ),
    );
  },
  async bookings(): Promise<Booking[]> {
    if (!DEMO) return list((await client.get("/api/bookings/")).data);
    await delay();
    const all = read<Booking[]>("bookings", []);
    const user = useStore.getState().user;
    return user?.role === "admin"
      ? all
      : all.filter((b) => b.userId === user?.id);
  },
  async booking(id: string): Promise<Booking> {
    if (!DEMO) return (await client.get(`/api/bookings/${id}/`)).data;
    const b = (await this.bookings()).find((b) => b.id === id);
    if (!b) throw Error("Booking not found");
    return b;
  },
  async book(
    flights: Flight[],
    passengers: Passenger[],
    key: string,
  ): Promise<Booking> {
    const user = useStore.getState().user;
    if (!user || user.status !== "approved")
      throw Error("An approved account is required");
    if (!DEMO)
      return (
        await client.post(
          "/api/bookings/",
          { flight_ids: flights.map((f) => f.id), passengers },
          { headers: { "Idempotency-Key": key } },
        )
      ).data;
    await delay();
    const all = read<Booking[]>("bookings", []);
    const prior = all.find((b) => b.id === key);
    if (prior) return prior;
    const b: Booking = {
      id: key,
      reference: "DEMO-" + key.slice(0, 6).toUpperCase(),
      userId: user.id,
      flights,
      passengers,
      total: flights.reduce((s, f) => s + f.price, 0) * passengers.length,
      status: "Confirmed",
      paymentStatus: "Simulated",
      createdAt: new Date().toISOString(),
      demo: true,
    };
    write("bookings", [b, ...all]);
    return b;
  },
  async adminFlights(): Promise<Flight[]> {
    return DEMO
      ? [
          ...mockFlights(defaultSearch).filter(
            (f) => !read<Flight[]>("flights", []).some((e) => e.id === f.id),
          ),
          ...read<Flight[]>("flights", []),
        ]
      : list((await client.get("/api/admin/flights/")).data);
  },
  async saveFlight(f: Flight): Promise<void> {
    if (!DEMO) throw Error("Flight creation/edit endpoint is not configured.");
    const all = read<Flight[]>("flights", []);
    write("flights", [f, ...all.filter((e) => e.id !== f.id)]);
  },
  async status(id: string, status: Flight["status"]): Promise<void> {
    if (!DEMO) {
      await client.put(`/api/admin/flights/${id}/status/`, { status });
      return;
    }
    const f = (await this.adminFlights()).find((f) => f.id === id);
    if (f)
      await this.saveFlight({
        ...f,
        status,
        updatedAt: new Date().toISOString(),
      });
  },
};
export const errorMessage = (e: unknown) =>
  axios.isAxiosError(e)
    ? typeof e.response?.data?.detail === "string"
      ? e.response.data.detail
      : "Unable to reach the service. Please try again."
    : e instanceof Error
      ? e.message
      : "Something went wrong. Please try again.";
