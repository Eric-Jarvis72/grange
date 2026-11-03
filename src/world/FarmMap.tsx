import * as ex from "excalibur";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hud } from "../inventory/Hud";
import { InventoryPanel } from "../inventory/InventoryPanel";
import { farmToolForItem } from "../inventory/items";
import { useNotificationStore } from "../notifications/notificationStore";
import { PauseMenu } from "../pause/PauseMenu";
import { usePauseStore } from "../pause/pauseStore";
import { emitLeaveFarm, emitVisitFarm } from "../socket";
import { useGameStore } from "../store";
import "../inventory/inventory.css";
import { useInventoryStore } from "../inventory/inventoryStore";
import { useInventoryKeys } from "../inventory/useInventoryKeys";
import { useInventoryPersistence } from "../inventory/useInventoryPersistence";
import { BankScene, type BankDesk } from "./BankScene";
import { BankWindow } from "./BankWindow";
import { bankResources } from "./bankResources";
import { type CasinoOverlay, CasinoOverlays } from "./CasinoOverlays";
import { CasinoScene } from "./CasinoScene";
import { ComboCounter } from "./ComboCounter";
import { casinoResources } from "./casinoResources";
import { FarmMapScene } from "./FarmMapScene";
import { FishingOverlay } from "./FishingOverlay";
import type { FarmHudSnapshot } from "./farmHud";
import "./farmMap.css";
import { MarketplaceScene } from "./MarketplaceScene";
import { MarketWindow } from "./MarketWindow";
import { LivestockMarketScene } from "./LivestockMarketScene";
import { LivestockPurchaseOverlay } from "./LivestockPurchaseOverlay";
import { LightingOverlay } from "./LightingOverlay";
import { livestockResources } from "./livestockResources";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { MARKETS } from "./marketData";
import { marketplaceResources } from "./marketplaceResources";
import { resources } from "./resources";
import { SleepVoteToast } from "./SleepVoteToast";
import { useBarnReconcile } from "./useBarnReconcile";
import { useFarmMarket } from "./useFarmMarket";
import { useFarmItemNotices, useFarmObjectInventory } from "./useFarmObjectInventory";
import { useLivestockPurchase } from "./useLivestockPurchase";
import type { WorldArea } from "./WalkingScene";

const worldResources = [
	...new Set([...resources, ...marketplaceResources, ...casinoResources, ...livestockResources, ...bankResources]),
];

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const getGameCanvas = useCallback(() => canvasRef.current, []);
	const [gameEngine, setGameEngine] = useState<ex.Engine | null>(null);
	useInventoryKeys();
	const sceneRef = useRef<FarmMapScene | null>(null);
	const marketSceneRef = useRef<MarketplaceScene | null>(null);
	const casinoRef = useRef<CasinoScene | null>(null);
	const livestockRef = useRef<LivestockMarketScene | null>(null);
	const bankRef = useRef<BankScene | null>(null);
	const username = useGameStore((s) => s.username);
	const farm = useGameStore((s) => s.activeFarm);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const heldItem = hotbar[selectedHotbar]?.itemId ?? null;
	const heldTool = farmToolForItem(heldItem);
	const setInventoryOpen = useInventoryStore((s) => s.setInventoryOpen);
	const inventoryHydrated = useInventoryStore((s) => s.inventoryHydrated);
	const pushNotice = useNotificationStore((s) => s.push);
	const paused = usePauseStore((s) => s.paused);
	const setPaused = usePauseStore((s) => s.setPaused);
	const { owner } = useParams<{ owner?: string }>();
	const navigate = useNavigate();
	const [hud, setHud] = useState<FarmHudSnapshot>({
		tomatoes: 0,
		message: "Hoe: click or drag on grass to till.",
		hovered: null,
	});

	const target = owner ?? username;
	const isOwner = target === username;
	const {
		market,
		marketMessage,
		setMarket,
		setMarketMessage,
		closeMarket,
		itemControls,
	} = useFarmMarket(target, isOwner);

	useEffect(() => {
		if (!target) return;

		emitVisitFarm(target, (res) => {
			if (!res.ok) navigate("/dashboard", { replace: true });
		});

		return () => emitLeaveFarm();
	}, [target, navigate]);

	// Selecting a hotbar slot drives the farm hint (the hotbar is the single
	// tool selector). The action itself reads the held item directly.
	useEffect(() => {
		sceneRef.current?.setHeldTool(heldTool);
	}, [heldTool]);

	// Tell the scene an active slot changed so the combo tracker can grant its
	// one-time chaining grace on the next different action.
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires on slot change by design
	useEffect(() => {
		sceneRef.current?.noteHotbarSwap();
	}, [selectedHotbar]);

	useFarmItemNotices(heldItem);

	useFarmObjectInventory(farm, isOwner);

	// Keep the local inventory's produce in sync with the authoritative barn.
	useBarnReconcile(farm?.barn ?? null, isOwner);

	// Persist the signed-in account's layout after any local inventory change.
	// The visited farm may belong to someone else; the save is scoped by session.
	useInventoryPersistence(inventoryHydrated, username);

	const [area, setArea] = useState<WorldArea>("Farm");
	const [travelPrompt, setTravelPrompt] = useState<string | null>(null);
	const [casinoOverlay, setCasinoOverlay] = useState<CasinoOverlay | null>(null);
	const [bankDesk, setBankDesk] = useState<BankDesk | null>(null);
	const livestock = useLivestockPurchase(isOwner, username);
	const { select: selectAnimal, setMessage: setLivestockMessage } = livestock;
	const [fishingOpen, setFishingOpen] = useState(false);
	const [engineReady, setEngineReady] = useState(false);

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
		setGameEngine(engine);

		const scene = new FarmMapScene(
			target,
			isOwner,
			setTravelPrompt,
			setArea,
			() => {
				scene.setOverlayPaused(true);
				setFishingOpen(true);
			},
		);
		scene.onFarmUpdate = (snapshot) => {
			if (cancelled) return;
			setHud(snapshot);
			setEngineReady(true);
		};
		sceneRef.current = scene;
		engine.addScene("farm-map", scene);
		const marketplace = new MarketplaceScene(setTravelPrompt, setArea, (id) => {
			marketplace.setPaused(true);
			setMarketMessage(null);
			setMarket(id);
		});
		marketSceneRef.current = marketplace;
		engine.addScene("marketplace", marketplace);
		const livestockScene = new LivestockMarketScene(setTravelPrompt, setArea, (id) => {
			livestockScene.setPaused(true);
			selectAnimal(id);
			setLivestockMessage(null);
		});
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
		void Promise.all(worldResources.map((resource) => resource.load())).then(
			async () => {
				if (cancelled) return;
				await engine.start();
				if (cancelled) return;
				await engine.goToScene("farm-map");
			},
		);

		return () => {
			cancelled = true;
			sceneRef.current = null;
			marketSceneRef.current = null;
			casinoRef.current = null;
			livestockRef.current = null;
			bankRef.current = null;
			setGameEngine(null);
			engine.stop();
			engine.dispose();
		};
	}, [target, isOwner, setMarket, setMarketMessage, selectAnimal, setLivestockMessage]);

	// Route farm hints and errors into the bottom-left feed.
	useEffect(() => {
		if (hud.message) pushNotice(hud.message, "system");
	}, [hud.message, pushNotice]);

	useEffect(() => {
		if (!target) return;
		pushNotice(
			isOwner ? "Welcome to your farm." : `Visiting ${target}'s farm.`,
			"system",
		);
	}, [target, isOwner, pushNotice]);

	// Leaving the world closes any open overlay so re-entry starts fresh.
	useEffect(() => {
		return () => {
			setPaused(false);
			setInventoryOpen(false);
			setFishingOpen(false);
		};
	}, [setPaused, setInventoryOpen]);

	function handleCloseMarket() {
		closeMarket();
		marketSceneRef.current?.setPaused(false);
	}

	function closeCasinoOverlay() {
		casinoRef.current?.setPaused(false);
		setCasinoOverlay(null);
	}

	function closeLivestockPurchase() {
		if (livestock.busy) return;
		livestockRef.current?.setPaused(false);
		livestock.select(null);
		livestock.setMessage(null);
	}

	function closeBank() {
		bankRef.current?.setPaused(false);
		setBankDesk(null);
	}

	function closeFishing() {
		sceneRef.current?.setOverlayPaused(false);
		setFishingOpen(false);
	}

	// The farm channel join is what sets `farm`; until it lands, an action would
	// be dropped by emitFarmAction, so the world isn't interactive yet.
	const worldReady =
		engineReady && farm !== null && (!isOwner || inventoryHydrated);

	return (
		<main
			className="farm-map-page"
			data-world-ready={worldReady ? "true" : "false"}
		>
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label={`${area} map. Use WASD or arrow keys to walk.`}
			/>
			<LightingOverlay engine={gameEngine} area={area} getGameCanvas={getGameCanvas} />
			{market && (
				<MarketWindow
					market={MARKETS[market]}
					controls={itemControls}
					message={marketMessage}
					onClose={handleCloseMarket}
				/>
			)}
			{livestock.pen && (
				<LivestockPurchaseOverlay
					pen={livestock.pen}
					owned={farm?.animals?.[livestock.pen.id] ?? 0}
					isOwner={isOwner}
					busy={livestock.busy}
					message={livestock.message}
					onBuy={livestock.buy}
					onClose={closeLivestockPurchase}
				/>
			)}
			{bankDesk && <BankWindow desk={bankDesk} isOwner={isOwner} onClose={closeBank} />}
			{travelPrompt && (
				<div
					className={`farm-map-travel-prompt${travelPrompt.includes("closed") ? " farm-map-travel-prompt-closed" : ""}`}
					data-testid="travel-prompt"
				>
					{travelPrompt}
				</div>
			)}
			{area === "Farm" && (
				<div className="farm-hud" data-testid="farm-hud">
					<div className="farm-status">
						<span data-testid="farm-tomatoes">🍅 {hud.tomatoes}</span>
					</div>
					<p className="farm-hint" data-testid="farm-hint">
						{hud.message}
					</p>
				</div>
			)}
			{!market && (!isOwner || inventoryHydrated) && (
				<Hud tiles={farm?.tiles.length ?? 0} hovered={hud.hovered} />
			)}
			<ComboCounter />
			<InventoryPanel />
			<SleepVoteToast />
			{paused && <PauseMenu />}
			{fishingOpen && <FishingOverlay onClose={closeFishing} />}
			<CasinoOverlays open={casinoOverlay} onClose={closeCasinoOverlay} />
		</main>
	);
}
