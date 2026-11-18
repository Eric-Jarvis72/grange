import { useCallback, useEffect, useState, type RefObject } from "react";
import { useNpcStore } from "./npcStore";
import type { FarmMapScene } from "./FarmMapScene";
import {
	type NpcCrop,
	type NpcSeedOffer,
	npcSaleMessage,
	npcThanksNeeded,
} from "./npcQuest";
import { emitNpcIntroSeen, emitNpcSell } from "./npcSocket";
import { economy } from "./EconomyManager";
import { orderSeeds } from "./seedShop";

/**
 * The farmhand's conversation state.
 *
 * The quest itself is server-authoritative (`npcStore` mirrors the join reply
 * and trade acks); this hook only owns whether the window is open and the
 * one-line result message shown under his dialogue.
 */
export function useNpcTrade(
	sceneRef: RefObject<FarmMapScene | null>,
	target: string | undefined,
	isOwner: boolean,
) {
	const status = useNpcStore((s) => s.status);
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [thanks, setThanks] = useState<NpcCrop | null>(null);
	const [busy, setBusy] = useState(false);

	const closeWindow = useCallback(() => {
		sceneRef.current?.setMenuPaused(false);
		setOpen(false);
		setMessage(null);
		setThanks(null);
	}, [sceneRef]);

	// The farmhand never appears for visitors; if the session drops or the
	// snapshot clears mid-conversation, close rather than strand the player in
	// a paused scene.
	useEffect(() => {
		if (!open) return;
		if (!isOwner || status === null) closeWindow();
	}, [open, isOwner, status, closeWindow]);

	const openNpc = useCallback(() => {
		const current = useNpcStore.getState().status;
		if (!current || current.stage === "complete") return;
		setMessage(null);
		setThanks(null);
		sceneRef.current?.setMenuPaused(true);
		setOpen(true);
	}, [sceneRef]);

	const acknowledgeIntro = useCallback(() => {
		if (!target || busy) return;
		setBusy(true);
		emitNpcIntroSeen(target, (res) => {
			setBusy(false);
			// On success the ack advances the stage, so the window stays open
			// and redraws itself as the tomato order.
			if (!res.ok) setMessage(res.error ?? "Could not talk to him.");
		});
	}, [busy, target]);

	const dismissThanks = useCallback(() => {
		setThanks(null);
		setMessage(null);
	}, []);

	/** Esc, the close button, and the intro's "What do you need?" all land here. */
	const closeNpc = useCallback(() => {
		const current = useNpcStore.getState().status;
		if (current?.stage === "intro") {
			// Dismissing the welcome counts as seeing it, so it never repeats;
			// the conversation then continues on the order instead of ending.
			acknowledgeIntro();
			return;
		}
		// The thank-you card is part of the conversation too: dismissing it
		// reveals the next stage's menu.
		if (thanks) {
			dismissThanks();
			return;
		}
		sceneRef.current?.setMenuPaused(false);
		setOpen(false);
		setMessage(null);
	}, [acknowledgeIntro, dismissThanks, sceneRef, thanks]);

	const sell = useCallback(
		(crop: NpcCrop) => {
			if (!target || busy) return;
			const before = useNpcStore.getState().status?.stage;
			setBusy(true);
			emitNpcSell(target, crop, (res) => {
				setBusy(false);
				if (!res.ok) {
					setMessage(res.error ?? "He would not take those.");
					return;
				}
				if (typeof res.balance === "number") economy.setBalance(res.balance);
				const after = useNpcStore.getState().status?.stage;
				if (before && after && npcThanksNeeded(before, after)) {
					// The ack already moved the quest on; hold the next menu
					// back so his thanks gets a screen of its own.
					setThanks(crop);
					setMessage(null);
					return;
				}
				setMessage(npcSaleMessage(crop));
			});
		},
		[busy, target],
	);

	const buySeeds = useCallback(
		(offer: NpcSeedOffer) => {
			if (busy) return;
			setBusy(true);
			void orderSeeds(offer.marketItemId, offer.quantity).then((result) => {
				setBusy(false);
				setMessage(
					result.ok
						? `Bought ${offer.quantity} ${offer.label.toLowerCase()} for ${result.total} GC.`
						: (result.error ?? "Purchase failed."),
				);
			});
		},
		[busy],
	);

	return {
		status,
		npcOpen: open,
		npcMessage: message,
		npcThanks: thanks,
		npcBusy: busy,
		openNpc,
		closeNpc,
		acknowledgeIntro,
		dismissThanks,
		sell,
		buySeeds,
	};
}
