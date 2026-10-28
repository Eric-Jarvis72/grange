/** Fish rarity tiers, from the everyday catch to the once-in-a-lifetime one. */
export type FishRarity = "common" | "uncommon" | "rare" | "legendary";

/** A single catchable fish and its sell value. */
export interface FishDef {
	id: FishId;
	name: string;
	emoji: string;
	rarity: FishRarity;
	/** Grangecoin the market pays per fish. */
	value: number;
	blurb: string;
	/** Special on-catch effect, if any. */
	effect?: "steal" | "clear-debt";
	/** Overrides the rarity's base weight (lower = rarer). */
	baseWeight?: number;
}

export type FishId =
	| "minnow"
	| "bluegill"
	| "carp"
	| "catfish"
	| "trout"
	| "salmon"
	| "golden-carp"
	| "phishing"
	| "loan-sharks-brother";

export const FISH: Record<FishId, FishDef> = {
	minnow: {
		id: "minnow",
		name: "Minnow",
		emoji: "🐟",
		rarity: "common",
		value: 2,
		blurb: "A tiny fish. Bites constantly.",
	},
	bluegill: {
		id: "bluegill",
		name: "Bluegill",
		emoji: "🐠",
		rarity: "common",
		value: 4,
		blurb: "A cheerful little panfish.",
	},
	carp: {
		id: "carp",
		name: "Carp",
		emoji: "🎏",
		rarity: "uncommon",
		value: 7,
		blurb: "Muddy, but worth a few coins.",
	},
	catfish: {
		id: "catfish",
		name: "Catfish",
		emoji: "🐡",
		rarity: "uncommon",
		value: 12,
		blurb: "Whiskered bottom-feeder.",
	},
	trout: {
		id: "trout",
		name: "Trout",
		emoji: "🐟",
		rarity: "rare",
		value: 20,
		blurb: "A prized river catch.",
	},
	salmon: {
		id: "salmon",
		name: "Salmon",
		emoji: "🍣",
		rarity: "rare",
		value: 30,
		blurb: "Fat and gleaming. Sells well.",
	},
	"golden-carp": {
		id: "golden-carp",
		name: "Golden Carp",
		emoji: "🥇",
		rarity: "rare",
		value: 75,
		blurb: "A shimmering prize. Lucky indeed.",
		baseWeight: 6,
	},
	phishing: {
		id: "phishing",
		name: "Phishing",
		emoji: "🎣",
		rarity: "legendary",
		value: 80,
		blurb: "Lures a rival's earnings into your creel.",
		effect: "steal",
		baseWeight: 1.5,
	},
	"loan-sharks-brother": {
		id: "loan-sharks-brother",
		name: "Loan Shark's Brother",
		emoji: "🦈",
		rarity: "legendary",
		value: 150,
		blurb: "Sinks its teeth into debt and leaves your slate clean.",
		effect: "clear-debt",
		baseWeight: 0.8,
	},
};

/** Market display order: everyday catches first, legends last. */
export const FISH_ORDER: readonly FishId[] = [
	"minnow",
	"bluegill",
	"carp",
	"catfish",
	"trout",
	"salmon",
	"golden-carp",
	"phishing",
	"loan-sharks-brother",
];

export const RARITY_LABEL: Record<FishRarity, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	legendary: "Legendary",
};

/** A fishing rod. Higher luck biases casts toward rarer fish. */
export interface RodDef {
	id: RodId;
	name: string;
	icon: string;
	/** Adds to the rare-fish bias; the starter rod is luck 0. */
	luck: number;
	/** Grangecoin cost at the market. */
	cost: number;
	blurb: string;
}

export type RodId = "bamboo" | "fiberglass" | "carbon" | "master";

/** The rod every angler starts with and never pays for. */
export const STARTER_ROD: RodId = "bamboo";

export const RODS: Record<RodId, RodDef> = {
	bamboo: {
		id: "bamboo",
		name: "Bamboo Rod",
		icon: "/assets/fishing/rod-bamboo.svg",
		luck: 0,
		cost: 100,
		blurb: "A humble starter rod.",
	},
	fiberglass: {
		id: "fiberglass",
		name: "Fiberglass Rod",
		icon: "/assets/fishing/rod-fiberglass.svg",
		luck: 1,
		cost: 1_000,
		blurb: "+1 luck. Rarer fish start showing up.",
	},
	carbon: {
		id: "carbon",
		name: "Carbon Rod",
		icon: "/assets/fishing/rod-carbon.svg",
		luck: 2,
		cost: 4_000,
		blurb: "+2 luck. A serious angler's tool.",
	},
	master: {
		id: "master",
		name: "Master Rod",
		icon: "/assets/fishing/rod-master.svg",
		luck: 3,
		cost: 10_000,
		blurb: "+3 luck. Tempts the legendary fish.",
	},
};

export const ROD_ORDER: readonly RodId[] = [
	"bamboo",
	"fiberglass",
	"carbon",
	"master",
];

export function isFishId(value: string): value is FishId {
	return (FISH_ORDER as readonly string[]).includes(value);
}

export function isRodId(value: string): value is RodId {
	return (ROD_ORDER as readonly string[]).includes(value);
}
