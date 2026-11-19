import { z } from "zod";
export const brand = {
  name: "AirB",
  fullName: "Air Booking",
  tagline: "Above the ordinary.",
  currency: "INR",
};
export interface Airport {
  id: number;
  code: string;
  name: string;
  city: string;
  country: string;
  region?: string;
  timezone: string;
  active: boolean;
  latitude: string | null;
  longitude: string | null;
}
export interface Route {
  id: number;
  origin: number;
  destination: number;
  active: boolean;
  distance_km: number | null;
  duration_minutes: number | null;
  origin_detail: Airport;
  destination_detail: Airport;
}
export const city = (code: string, name?: string) => name || code;
export const money = (n: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
export const dateAfter = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const prettyDate = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const searchSchema = z
  .object({
    type: z.enum(["round", "one"]),
    origin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Choose an origin airport"),
    destination: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Choose a destination airport"),
    departure: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= dateAfter(0),
        "Choose today or a future date",
      ),
    returnDate: z.string(),
    passengers: z.number().int().min(1).max(9),
    cabin: z.enum(["Economy", "Premium economy", "Business"]),
  })
  .refine((v) => v.origin !== v.destination, {
    message: "Choose different airports",
    path: ["destination"],
  })
  .refine((v) => v.type === "one" || v.returnDate >= v.departure, {
    message: "Return must be on or after departure",
    path: ["returnDate"],
  });
export type Search = z.infer<typeof searchSchema>;
export const defaultSearch: Search = {
  type: "round",
  origin: "BLR",
  destination: "DEL",
  departure: dateAfter(14),
  returnDate: dateAfter(21),
  passengers: 1,
  cabin: "Economy",
};
export type Status =
  "Scheduled" | "On time" | "Delayed" | "Cancelled" | "Departed" | "Arrived";
export interface Flight {
  id: string;
  number: string;
  route?: number | null;
  schedule_source?: "airlabs_routes" | "database";
  aircraft?: Aircraft;
  status_source?: string;
  demonstration?: boolean;
  origin_city?: string;
  destination_city?: string;
  departure_datetime?: string;
  arrival_datetime?: string;
  airline: string;
  origin: string;
  destination: string;
  date: string;
  departure: string;
  arrival: string;
  arrivalDay: number;
  duration: number;
  stops: number;
  price: number;
  seats: number;
  status: Status;
  updatedAt?: string;
  total_seats?: number;
  currency?: string;
}
export type FlightSearchSource = "airlabs_routes" | "database";
export interface Aircraft {
  aircraft_icao?: string;
  model?: string;
  manufacturer?: string;
  reg_number?: string;
}
export interface LiveFlight {
  number: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  status: string;
  aircraft: Aircraft;
  signal_at: string | null;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  phone?: string;
  is_active?: boolean;
  status: "pending" | "approved" | "rejected";
}
export const passengerSchema = z.object({
  firstName: z.string().trim().min(2, "Enter a first name"),
  lastName: z.string().trim().min(2, "Enter a last name"),
  email: z.string().email("Enter a valid email"),
  birthDate: z
    .string()
    .refine((v) => !!v && v < dateAfter(0), "Enter a valid date of birth"),
});
export type Passenger = z.infer<typeof passengerSchema>;
export interface Booking {
  id: string;
  reference: string;
  userId: string;
  flights: Flight[];
  passengers: Passenger[];
  total: number;
  currency?: string;
  status: "Pending" | "Confirmed" | "Cancelled";
  paymentStatus: "Simulated" | "Paid" | "Pending" | "Failed" | "Refunded";
  createdAt: string;
}
export const duration = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
