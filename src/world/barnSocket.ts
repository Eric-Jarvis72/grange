import type { BarnAction } from "../../shared/types";
import { type Ack, farmChannelFor, reasonOf } from "../socket";

/** Sells a produce item from the visited farm's barn back to the market. */
export function emitSellProduce(
	owner: string,
	item: string,
	count: number,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannelFor(owner);
	if (!channel) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("sellProduce", { item, count })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Could not sell" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

/** Deposits into or withdraws from the visited farm's barn storage. */
export function emitBarnAction(
	owner: string,
	action: BarnAction,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannelFor(owner);
	if (!channel) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("barnAction", { action })
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (payload: unknown) =>
			cb?.({
				ok: false,
				error: reasonOf(payload) ?? "Could not update the barn",
			}),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}
