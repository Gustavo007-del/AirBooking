import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultSearch, type Search, type User } from "./domain";
interface State {
  search: Search;
  user: User | null;
  setSearch: (s: Search) => void;
  setUser: (u: User | null) => void;
}
export const useStore = create<State>()(
  persist(
    (set) => ({
      search: defaultSearch,
      user: null,
      setSearch: (search) => set({ search }),
      setUser: (user) => set({ user }),
    }),
    { name: "aere-preferences", partialize: (s) => ({ search: s.search }) },
  ),
);
