import { z } from "zod";
export const brand = {
  name: "AERÉ",
  tagline: "Above the ordinary.",
  currency: "INR",
};
export const DEMO = import.meta.env.VITE_DATA_MODE !== "api";
export const airports = [
  { code: "DEL", city: "New Delhi", name: "Indira Gandhi International" },
  { code: "LHR", city: "London", name: "London Heathrow" },
  { code: "DXB", city: "Dubai", name: "Dubai International" },
  { code: "SIN", city: "Singapore", name: "Changi Airport" },
  { code: "NRT", city: "Tokyo", name: "Narita International" },
  { code: "DPS", city: "Bali", name: "Ngurah Rai International" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle" },
  { code: "JFK", city: "New York", name: "John F. Kennedy International" },
  {
    code: "BOM",
    city: "Mumbai",
    name: "Chhatrapati Shivaji Maharaj International",
  },
  { code: "ZRH", city: "Zurich", name: "Zurich Airport" },
];
export const city = (code: string) =>
  airports.find((a) => a.code === code)?.city || code;
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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
      .refine(
        (v) => airports.some((a) => a.code === v),
        "Choose an origin airport",
      ),
    destination: z
      .string()
      .refine(
        (v) => airports.some((a) => a.code === v),
        "Choose a destination airport",
      ),
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
  origin: "DEL",
  destination: "LHR",
  departure: dateAfter(14),
  returnDate: dateAfter(21),
  passengers: 1,
  cabin: "Economy",
};
export type Status =
  "On time" | "Delayed" | "Cancelled" | "Departed" | "Arrived";
export interface Flight {
  id: string;
  number: string;
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
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
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
  status: "Confirmed" | "Cancelled";
  paymentStatus: "Simulated" | "Paid" | "Pending";
  createdAt: string;
  demo: boolean;
}
export const duration = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
