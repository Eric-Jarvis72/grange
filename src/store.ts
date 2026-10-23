import { create } from "zustand";
import type { AuthUser } from "../shared/auth";
import type { ActiveFarm, FarmSummary, Player } from "../shared/types";

interface GameStore {
	user: AuthUser | null;
	username: string;
	players: Player[];
	farms: FarmSummary[];
	activeFarm: ActiveFarm | null;
	setUser: (user: AuthUser) => void;
	clearUser: () => void;
	setPlayers: (players: Player[]) => void;
	setFarms: (farms: FarmSummary[]) => void;
	setActiveFarm: (farm: ActiveFarm | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
	user: null,
	// Derived from the session, never persisted.
	username: "",
	players: [],
	farms: [],
	activeFarm: null,
	setUser: (user) => set({ user, username: user.username }),
	clearUser: () => set({ user: null, username: "", activeFarm: null }),
	setPlayers: (players) => set({ players }),
	setFarms: (farms) => set({ farms }),
	setActiveFarm: (activeFarm) => set({ activeFarm }),
}));
