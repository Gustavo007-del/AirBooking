import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchSchema,
  defaultSearch as emptySearch,
  dateAfter,
  passengerSchema,
} from "./domain";
import { service, client } from "./api";
import { useStore } from "./store";
import { errorMessage, fieldErrors } from "./feedback";

it("presents a Django password validation error without internal field names", () => {
  const message = "The password is too similar to the email.";
  const error = {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        detail: `non_field_errors: ${message}`,
        errors: { password: [message] },
      },
    },
  };
  const friendly =
    "Choose a password that is different from your email address.";
  expect(errorMessage(error)).toBe(friendly);
  expect(fieldErrors(error).password).toBe(friendly);
});
const defaultSearch = { ...emptySearch, origin: "DEL", destination: "LHR" };
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
afterEach(() => vi.restoreAllMocks());
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
  it("rejects a past departure and malformed airport code", () => {
    expect(
      searchSchema.safeParse({ ...defaultSearch, departure: "2020-01-01" })
        .success,
    ).toBe(false);
    expect(
      searchSchema.safeParse({ ...defaultSearch, origin: "XX" }).success,
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
    firstName: "Test",
    lastName: "Traveller",
    email: "test@example.com",
    birthDate: "1990-01-01",
  };
  it("rejects incomplete passenger details", () =>
    expect(
      passengerSchema.safeParse({ ...passenger, email: "invalid" }).success,
    ).toBe(false));
  it("blocks booking without an approved user", async () => {
    await expect(service.book([], [passenger], "test-id")).rejects.toThrow(
      "approved",
    );
    useStore.getState().setUser({
      id: "pending",
      name: "Pending",
      email: "pending@example.com",
      role: "user",
      status: "pending",
    });
    await expect(service.book([], [passenger], "test-id")).rejects.toThrow(
      "approved",
    );
  });

  it("sends cabin and idempotency key, then pays the reservation", async () => {
    useStore.getState().setUser({
      id: "user",
      name: "Traveller",
      email: "test@example.com",
      role: "user",
      status: "approved",
    });
    useStore.getState().setSearch({ ...defaultSearch, cabin: "Business" });
    const post = vi
      .spyOn(client, "post")
      .mockResolvedValueOnce({ data: { id: "reservation", status: "Pending" } })
      .mockResolvedValueOnce({
        data: {
          id: "reservation",
          status: "Confirmed",
          paymentStatus: "Simulated",
        },
      });
    const result = await service.book([], [passenger], "request-key");
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/api/bookings/",
      { flight_ids: [], passengers: [passenger], cabin: "Business" },
      { headers: { "Idempotency-Key": "request-key" } },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/api/bookings/reservation/payment/",
      { outcome: "success" },
    );
    expect(result.status).toBe("Confirmed");
  });
  it("does not replace a failed search with generated flights", async () => {
    vi.spyOn(client, "get").mockRejectedValueOnce(
      new Error("Service unavailable"),
    );
    await expect(service.search(defaultSearch)).rejects.toThrow(
      "Service unavailable",
    );
  });
  it("sends the selected cabin when retrieving a flight", async () => {
    useStore.getState().setSearch({ ...defaultSearch, cabin: "Business" });
    const get = vi
      .spyOn(client, "get")
      .mockResolvedValueOnce({ data: { id: "flight", price: 280 } });
    expect((await service.flight("flight")).price).toBe(280);
    expect(get).toHaveBeenCalledWith("/api/flights/flight/", {
      params: { cabin: "Business" },
    });
  });
});
