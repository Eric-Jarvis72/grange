import { CROPS, catalystForItem } from "../../shared/crops";

/** Server push when a pending catalyst resolves at dawn. */
export interface CatalystAppliedPayload {
	item: string;
	standard: string;
	crop: string;
	count: number;
}

/** Confirmation shown right after a catalyst is consumed. */
export function catalystQueuedNotice(item: string): string {
	const catalyst = catalystForItem(item);
	if (!catalyst) return "The catalyst is brewing.";
	const crop = CROPS[catalyst.standardCrop].name;
	return `The ${catalyst.name} will transform your ${crop} at dawn.`;
}

/** Completion notice for the dawn push. */
export function catalystAppliedNotice(payload: CatalystAppliedPayload): string {
	const catalyst = catalystForItem(payload.item);
	const name = catalyst?.name ?? "Catalyst";
	const rare = catalyst ? CROPS[catalyst.rareCrop].name : payload.crop;
	const cropCount = payload.count === 1 ? "crop" : "crops";
	return `The ${name} transformed ${payload.count} ${cropCount} into ${rare}.`;
}
