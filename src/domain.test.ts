import { describe, it, expect, beforeEach } from "vitest";
import {
  searchSchema,
  defaultSearch,
  dateAfter,
  passengerSchema,
} from "./domain";
import { service, mockFlights } from "./api";
import { useStore } from "./store";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
beforeEach(() => {
  memory.clear();
  useStore.getState().setUser(null);
  useStore.getState().setSearch(defaultSearch);
});
describe("Flight search validation", () => {
  it("accepts a valid round trip", () =>
    expect(searchSchema.safeParse(defaultSearch).success).toBe(true));
  it("rejects identical airports", () =>
    expect(
      searchSchema.safeParse({
        ...defaultSearch,
        destination: defaultSearch.origin,
      }).success,
    ).toBe(false));
  it("rejects a return before departure", () =>
    expect(
      searchSchema.safeParse({ ...defaultSearch, returnDate: dateAfter(1) })
        .success,
    ).toBe(false));
  it("rejects a past departure and unknown airport", () => {
    expect(
      searchSchema.safeParse({ ...defaultSearch, departure: "2020-01-01" })
        .success,
    ).toBe(false);
    expect(
      searchSchema.safeParse({ ...defaultSearch, origin: "XYZ" }).success,
    ).toBe(false);
  });
  it("allows one way without return date", () =>
    expect(
      searchSchema.safeParse({ ...defaultSearch, type: "one", returnDate: "" })
        .success,
    ).toBe(true));
  it("requires an integer passenger count", () =>
    expect(
      searchSchema.safeParse({ ...defaultSearch, passengers: 1.5 }).success,
    ).toBe(false));
});
describe("Booking trust boundaries", () => {
  const passenger = {
    firstName: "Demo",
    lastName: "Traveller",
    email: "demo@example.com",
    birthDate: "1990-01-01",
  };
  it("rejects incomplete passenger details", () =>
    expect(
      passengerSchema.safeParse({ ...passenger, email: "invalid" }).success,
    ).toBe(false));
  it("blocks booking without an approved user", async () => {
    await expect(
      service.book(
        mockFlights(defaultSearch).slice(0, 1),
        [passenger],
        "test-id",
      ),
    ).rejects.toThrow("approved");
    useStore
      .getState()
      .setUser({
        id: "pending",
        name: "Pending",
        email: "pending@example.com",
        role: "user",
        status: "pending",
      });
    await expect(
      service.book(
        mockFlights(defaultSearch).slice(0, 1),
        [passenger],
        "test-id",
      ),
    ).rejects.toThrow("approved");
  });
  it("creates an explicitly simulated round trip and deduplicates retries", async () => {
    useStore.getState().setUser(await service.demoLogin("user"));
    const legs = [
      mockFlights(defaultSearch)[0],
      mockFlights({
        ...defaultSearch,
        origin: "LHR",
        destination: "DEL",
        departure: defaultSearch.returnDate,
      })[1],
    ];
    const b = await service.book(legs, [passenger], "test-booking");
    expect(b.demo).toBe(true);
    expect(b.paymentStatus).toBe("Simulated");
    expect(b.total).toBe(legs[0].price + legs[1].price);
    await service.book(legs, [passenger], "test-booking");
    expect(await service.bookings()).toHaveLength(1);
  });
  it("does not expose another demo user’s bookings", async () => {
    useStore.getState().setUser(await service.demoLogin("user"));
    await service.book(
      [mockFlights(defaultSearch)[0]],
      [passenger],
      "private-booking",
    );
    useStore
      .getState()
      .setUser({
        id: "other",
        name: "Other",
        email: "other@example.com",
        role: "user",
        status: "approved",
      });
    expect(await service.bookings()).toHaveLength(0);
  });
  it("preserves cabin pricing when retrieving a selected flight", async () => {
    const s = { ...defaultSearch, cabin: "Business" as const };
    useStore.getState().setSearch(s);
    const f = mockFlights(s)[0];
    expect((await service.flight(f.id)).price).toBe(f.price);
  });
});
