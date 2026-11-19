import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultSearch, type Search, type User } from "./domain";
interface State {
  sessionReady: boolean;
  setSessionReady: () => void;
  search: Search;
  user: User | null;
  setSearch: (s: Search) => void;
  setUser: (u: User | null) => void;
}
export const useStore = create<State>()(
  persist(
    (set) => ({
      sessionReady: false,
      setSessionReady: () => set({ sessionReady: true }),
      search: defaultSearch,
      user: null,
      setSearch: (search) => set({ search }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "aere-preferences",
      partialize: (s) => ({ search: s.search }),
      merge: (persisted, current) => {
        const saved = (persisted as { search?: Search } | undefined)?.search;
        if (!saved) return current;
        const search =
          !saved.origin && !saved.destination
            ? {
                ...saved,
                origin: defaultSearch.origin,
                destination: defaultSearch.destination,
              }
            : saved;
        return { ...current, search };
      },
    },
  ),
);
