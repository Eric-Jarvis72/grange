import { create } from "zustand";
import type { AuthUser } from "../shared/auth";
import { type DayPhase, dayPhaseNow, type WorldTime } from "../shared/mechanics";
import type {
	ActiveFarm,
	FarmSummary,
	Player,
	SleepVote,
	SleepVoteResultPayload,
} from "../shared/types";

interface GameStore {
	user: AuthUser | null;
	username: string;
	players: Player[];
	farms: FarmSummary[];
	activeFarm: ActiveFarm | null;
	worldTime: WorldTime | null;
	sleepVote: SleepVote | null;
	sleepResult: SleepVoteResultPayload | null;
	setUser: (user: AuthUser) => void;
	clearUser: () => void;
	setPlayers: (players: Player[]) => void;
	setFarms: (farms: FarmSummary[]) => void;
	setActiveFarm: (farm: ActiveFarm | null) => void;
	setWorldTime: (time: WorldTime) => void;
	setSleepVote: (vote: SleepVote | null) => void;
	setSleepResult: (result: SleepVoteResultPayload | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
	user: null,
	// Derived from the session, never persisted.
	username: "",
	players: [],
	farms: [],
	activeFarm: null,
	worldTime: null,
	sleepVote: null,
	sleepResult: null,
	setUser: (user) => set({ user, username: user.username }),
	clearUser: () =>
		set({
			user: null,
			username: "",
			activeFarm: null,
			worldTime: null,
			sleepVote: null,
			sleepResult: null,
		}),
	setPlayers: (players) => set({ players }),
	setFarms: (farms) => set({ farms }),
	setActiveFarm: (activeFarm) => set({ activeFarm }),
	setWorldTime: (worldTime) => set({ worldTime }),
	setSleepVote: (sleepVote) => set({ sleepVote }),
	setSleepResult: (sleepResult) => set({ sleepResult }),
}));

/** The current day phase, extrapolated from the last server clock sync. */
export function currentDayPhase(): DayPhase {
	const time = useGameStore.getState().worldTime;
	return time ? dayPhaseNow(time) : "day";
}

export function isNightNow(): boolean {
	return currentDayPhase() === "night";
}
