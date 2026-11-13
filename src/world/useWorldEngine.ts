import * as ex from "excalibur";
import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useEffect,
} from "react";
import type { BankDesk } from "./BankScene";
import { BankScene } from "./BankScene";
import type { CasinoOverlay } from "./CasinoOverlays";
import { CasinoScene } from "./CasinoScene";
import { FarmMapScene } from "./FarmMapScene";
import type { FarmHudSnapshot } from "./farmHud";
import { LivestockMarketScene } from "./LivestockMarketScene";
import type { AnimalId } from "./livestockData";
import { MarketplaceScene } from "./MarketplaceScene";
import { FARM_TRAIN_ARRIVAL_SPAWN, MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import type { MarketId } from "./marketData";
import { requestedStartArea } from "./testMode";
import { consumeTrainArrival, peekTrainArrival } from "./trainArrival";
import type { WorldArea, WorldSceneName } from "./WalkingScene";
import { ensureSceneResources, preloadWorldResources } from "./worldAssets";

interface WorldEngineOptions {
	canvasRef: MutableRefObject<HTMLCanvasElement | null>;
	engineRef: MutableRefObject<ex.Engine | null>;
	sceneRef: MutableRefObject<FarmMapScene | null>;
	marketSceneRef: MutableRefObject<MarketplaceScene | null>;
	casinoRef: MutableRefObject<CasinoScene | null>;
	livestockRef: MutableRefObject<LivestockMarketScene | null>;
	bankRef: MutableRefObject<BankScene | null>;
	target: string | undefined;
	isOwner: boolean;
	setTravelPrompt: (prompt: string | null) => void;
	setArea: (area: WorldArea) => void;
	setHud: Dispatch<SetStateAction<FarmHudSnapshot>>;
	setEngineReady: (ready: boolean) => void;
	setMarket: (market: MarketId) => void;
}

interface SceneCallbacks {
	setMarketMessage: (message: string | null) => void;
	selectAnimal: (id: AnimalId | null) => void;
	setLivestockMessage: (message: string | null) => void;
	setBankDesk: (desk: BankDesk | null) => void;
	setCasinoOverlay: (overlay: CasinoOverlay | null) => void;
	setFishingOpen: (open: boolean) => void;
	openHouseMenu: () => void;
	openFarmTravelMenu: () => void;
	openMarketplaceTravelMenu: () => void;
}

/** Builds the Excalibur engine and its scenes for the world route. */
export function useWorldEngine(
	options: WorldEngineOptions & SceneCallbacks,
): void {
	const {
		canvasRef,
		engineRef,
		sceneRef,
		marketSceneRef,
		casinoRef,
		livestockRef,
		bankRef,
		target,
		isOwner,
		setTravelPrompt,
		setArea,
		setHud,
		setEngineReady,
		setMarket,
		setMarketMessage,
		selectAnimal,
		setLivestockMessage,
		setBankDesk,
		setCasinoOverlay,
		setFishingOpen,
		openHouseMenu,
		openFarmTravelMenu,
		openMarketplaceTravelMenu,
	} = options;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !target) return;

		let cancelled = false;
		setEngineReady(false);
		const engine = new ex.Engine({
			canvasElement: canvas,
			viewport: { width: MAP_WIDTH, height: MAP_HEIGHT },
			resolution: { width: MAP_WIDTH, height: MAP_HEIGHT },
			displayMode: ex.DisplayMode.FitContainer,
			pixelArt: true,
			suppressConsoleBootMessage: true,
			backgroundColor: ex.Color.fromHex("#79a44d"),
		});
		engineRef.current = engine;

		const scene = new FarmMapScene(
			target,
			isOwner,
			setTravelPrompt,
			setArea,
			() => {
				scene.setOverlayPaused(true);
				setFishingOpen(true);
			},
			openHouseMenu,
			openFarmTravelMenu,
		);
		scene.onFarmUpdate = (snapshot) => {
			if (cancelled) return;
			setHud(snapshot);
			setEngineReady(true);
		};
		sceneRef.current = scene;
		engine.addScene("farm-map", scene);

		const marketplace = new MarketplaceScene(
			setTravelPrompt,
			setArea,
			(id) => {
				marketplace.setPaused(true);
				setMarketMessage(null);
				setMarket(id);
			},
			openMarketplaceTravelMenu,
		);
		marketSceneRef.current = marketplace;
		engine.addScene("marketplace", marketplace);

		const livestockScene = new LivestockMarketScene(
			setTravelPrompt,
			setArea,
			(id) => {
				livestockScene.setPaused(true);
				selectAnimal(id);
				setLivestockMessage(null);
			},
		);
		livestockRef.current = livestockScene;
		engine.addScene("livestock-market", livestockScene);

		const bank = new BankScene(setTravelPrompt, setArea, (desk) => {
			bank.setPaused(true);
			setBankDesk(desk);
		});
		bankRef.current = bank;
		engine.addScene("bank", bank);

		function openCasino(overlay: CasinoOverlay) {
			casino.setPaused(true);
			setCasinoOverlay(overlay);
		}
		const casino = new CasinoScene(
			setTravelPrompt,
			setArea,
			() => openCasino("blackjack"),
			() => openCasino("poker"),
			() => openCasino("roulette"),
			() => openCasino("slots"),
		);
		casinoRef.current = casino;
		engine.addScene("casino", casino);

		// Boot only the first scene's artwork: a farm visit does not wait for
		// the casino, and a deep-linked hub does not wait for the crops. The
		// remaining scenes warm up behind the first frame.
		const arrivingAt = peekTrainArrival();
		const startArea = isOwner ? requestedStartArea() : null;
		const bootScene: WorldSceneName =
			startArea ?? (arrivingAt === "marketplace" ? "marketplace" : "farm-map");

		void ensureSceneResources(bootScene).then(async () => {
			if (cancelled) return;
			await engine.start();
			if (cancelled) return;
			// The arrival flag is one-shot, so always drain it even when the
			// e2e `?area=` hook takes over the first scene.
			const arrival = consumeTrainArrival();
			if (startArea) {
				await engine.goToScene(startArea);
			} else if (arrival === "marketplace") {
				await engine.goToScene("marketplace", {
					sceneActivationData: { trainArriving: true },
				});
			} else if (arrival === "farm-map") {
				await engine.goToScene("farm-map", {
					sceneActivationData: {
						spawn: FARM_TRAIN_ARRIVAL_SPAWN,
						trainArriving: true,
					},
				});
			} else {
				await engine.goToScene("farm-map");
			}
			// The engine is live once the first scene is active. Do not wait
			// for the farm scene's HUD emit: a world that boots into a hub
			// never initializes that scene, and the readiness gate would
			// stay false forever.
			if (cancelled) return;
			setEngineReady(true);
			preloadWorldResources(bootScene);
		});

		return () => {
			cancelled = true;
			sceneRef.current = null;
			marketSceneRef.current = null;
			casinoRef.current = null;
			livestockRef.current = null;
			bankRef.current = null;
			engineRef.current = null;
			engine.stop();
			engine.dispose();
		};
	}, [
		canvasRef,
		engineRef,
		sceneRef,
		marketSceneRef,
		casinoRef,
		livestockRef,
		bankRef,
		target,
		isOwner,
		setTravelPrompt,
		setArea,
		setHud,
		setEngineReady,
		setMarket,
		setMarketMessage,
		selectAnimal,
		setLivestockMessage,
		setBankDesk,
		setCasinoOverlay,
		setFishingOpen,
		openHouseMenu,
		openFarmTravelMenu,
		openMarketplaceTravelMenu,
	]);
}
