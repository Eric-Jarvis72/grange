import type * as ex from "excalibur";
import type { MarketplacePropKey } from "./marketplaceData";
import { image, propImages, trainImage } from "./resources";

export const marketplaceImages: Record<MarketplacePropKey, ex.ImageSource> = {
	"seed-shop": image("marketplace/buildings/seed-shop.webp"),
	"produce-stall": image("marketplace/buildings/produce-stall.webp"),
	"game-hall": image("marketplace/buildings/game-hall.webp"),
	"livestock-pavilion": image("marketplace/livestock/pavilion.webp"),
	"village-bank": image("marketplace/bank/exterior.webp"),
	"seed-display": image("marketplace/objects/seed-display.webp"),
	"produce-cart": image("marketplace/objects/produce-cart.webp"),
	"notice-board": image("marketplace/objects/notice-board.webp"),
	signpost: image("marketplace/objects/signpost.webp"),
	"starter-train": trainImage,
	"oak-tree": propImages["oak-tree"],
	"pine-tree": propImages["pine-tree"],
	daisies: propImages.daisies,
	marigolds: propImages.marigolds,
	barrel: propImages.barrel,
	crate: propImages.crate,
};

export const marketplaceResources = Object.values(marketplaceImages);
