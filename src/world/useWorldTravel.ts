import type * as ex from "excalibur";
import { type RefObject, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store";
import type { FarmMapScene } from "./FarmMapScene";
import type { MarketplaceScene } from "./MarketplaceScene";
import { FARM_TRAIN_ARRIVAL_SPAWN } from "./mapData";
import { markTrainArrival } from "./trainArrival";
import {
	type TrainLocation,
	type TravelDestination,
	trainDestinations,
} from "./travelDestinations";
import { useTravelMenuStore } from "./travelMenuStore";
import { ensureSceneResources } from "./worldAssets";

interface WorldTravelOptions {
	target: string | undefined;
	username: string;
	sceneRef: RefObject<FarmMapScene | null>;
	marketRef: RefObject<MarketplaceScene | null>;
	engineRef: RefObject<ex.Engine | null>;
}

/**
 * Opens the train destination menu and moves the player once they choose.
 *
 * Farm-to-farm and guest-to-marketplace trips remount the world through the
 * router with a one-shot arrival flag; trips inside the local farm's world go
 * straight to an Excalibur scene.
 */
export function useWorldTravel({
	target,
	username,
	sceneRef,
	marketRef,
	engineRef,
}: WorldTravelOptions) {
	const navigate = useNavigate();

	useEffect(() => () => useTravelMenuStore.getState().closeMenu(), []);

	const chooseDestination = useCallback(
		async (location: TrainLocation, destination: TravelDestination) => {
			if (!target) return;
			if (location.kind === "marketplace") {
				marketRef.current?.setPaused(false);
				await marketRef.current?.departTrain();
			} else {
				sceneRef.current?.setMenuPaused(false);
				await sceneRef.current?.departTrain();
			}

			if (destination.kind === "marketplace") {
				if (target === username) {
					await ensureSceneResources("marketplace");
					await engineRef.current?.goToScene("marketplace", {
						sceneActivationData: { trainArriving: true },
					});
				} else {
					markTrainArrival("marketplace");
					navigate("/world");
				}
				return;
			}

			if (destination.kind === "home") {
				if (target === username) {
					await ensureSceneResources("farm-map");
					await engineRef.current?.goToScene("farm-map", {
						sceneActivationData: {
							spawn: FARM_TRAIN_ARRIVAL_SPAWN,
							trainArriving: true,
						},
					});
				} else {
					markTrainArrival("farm-map");
					navigate("/world");
				}
				return;
			}

			if (!destination.owner) return;
			markTrainArrival("farm-map");
			navigate(`/farms/${destination.owner}`);
		},
		[target, username, navigate, sceneRef, marketRef, engineRef],
	);

	const openTravelMenu = useCallback(
		(location: TrainLocation, onCancel: () => void) => {
			const options = trainDestinations(
				location,
				useGameStore.getState().farms,
				username,
			).map((destination) => ({
				id: destination.id,
				label: destination.label,
				detail: destination.detail,
				onSelect: () => void chooseDestination(location, destination),
			}));
			useTravelMenuStore.getState().openMenu("Where to?", options, onCancel);
		},
		[username, chooseDestination],
	);

	const openFarmTravelMenu = useCallback(() => {
		if (!target) return;
		sceneRef.current?.setMenuPaused(true);
		openTravelMenu({ kind: "farm", owner: target }, () =>
			sceneRef.current?.setMenuPaused(false),
		);
	}, [target, openTravelMenu, sceneRef]);

	const openMarketplaceTravelMenu = useCallback(() => {
		marketRef.current?.setPaused(true);
		openTravelMenu({ kind: "marketplace" }, () =>
			marketRef.current?.setPaused(false),
		);
	}, [openTravelMenu, marketRef]);

	return { openFarmTravelMenu, openMarketplaceTravelMenu };
}
