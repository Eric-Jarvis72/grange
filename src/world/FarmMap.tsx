import type * as ex from "excalibur";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hud } from "../inventory/Hud";
import { InventoryPanel } from "../inventory/InventoryPanel";
import { farmToolForItem } from "../inventory/items";
import { useNotificationStore } from "../notifications/notificationStore";
import { PauseMenu } from "../pause/PauseMenu";
import { usePauseStore } from "../pause/pauseStore";
import { emitLeaveFarm, emitPauseFarmVisit, emitVisitFarm } from "../socket";
import { useGameStore } from "../store";
import "../inventory/inventory.css";
import { useInventoryStore } from "../inventory/inventoryStore";
import { useInventoryKeys } from "../inventory/useInventoryKeys";
import { useInventoryPersistence } from "../inventory/useInventoryPersistence";
import type { BankDesk, BankScene } from "./BankScene";
import { BankWindow } from "./BankWindow";
import { type CasinoOverlay, CasinoOverlays } from "./CasinoOverlays";
import type { CasinoScene } from "./CasinoScene";
import { ComboCounter } from "./ComboCounter";
import type { FarmMapScene } from "./FarmMapScene";
import { FishingOverlay } from "./FishingOverlay";
import type { FarmHudSnapshot } from "./farmHud";
import { subscribeFarmPeers } from "./farmPresence";
import "./farmMap.css";
import { HouseMenu } from "./HouseMenu";
import { leaveHub, subscribeHubPeers } from "./hubClient";
import type { LivestockMarketScene } from "./LivestockMarketScene";
import { LivestockPurchaseOverlay } from "./LivestockPurchaseOverlay";
import type { MarketplaceScene } from "./MarketplaceScene";
import { MarketWindow } from "./MarketWindow";
import { MARKETS } from "./marketData";
import { TravelMenu } from "./TravelMenu";
import { useBarnReconcile } from "./useBarnReconcile";
import { useFarmMarket } from "./useFarmMarket";
import {
	useFarmItemNotices,
	useFarmObjectInventory,
} from "./useFarmObjectInventory";
import { useHouseMenu } from "./useHouseMenu";
import { useLivestockPurchase } from "./useLivestockPurchase";
import { useWorldEngine } from "./useWorldEngine";
import { useWorldTravel } from "./useWorldTravel";
import type { WorldArea } from "./WalkingScene";

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<ex.Engine | null>(null);
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
		player: { x: 0, y: 0 },
	});

	const target = owner ?? username;
	const isOwner = target === username;
	const [area, setArea] = useState<WorldArea>("Farm");
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

		const onFarm = area === "Farm";
		// The farm snapshot feeds the HUD and `data-world-ready` even when the
		// world boots into a hub, so join it first and only then decide whether
		// the player should publish farm presence.
		emitVisitFarm(
			target,
			(res) => {
				if (!res.ok) navigate("/dashboard", { replace: true });
			},
			onFarm,
		);
		if (!onFarm) emitPauseFarmVisit();
	}, [target, area, navigate]);

	// Unmounting the world must clear the active farm and presence.
	useEffect(() => () => emitLeaveFarm(), []);

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

	const [travelPrompt, setTravelPrompt] = useState<string | null>(null);
	const [hubPeers, setHubPeers] = useState<string[]>([]);
	const [farmPeers, setFarmPeers] = useState<string[]>([]);
	const [casinoOverlay, setCasinoOverlay] = useState<CasinoOverlay | null>(
		null,
	);
	const [bankDesk, setBankDesk] = useState<BankDesk | null>(null);
	const livestock = useLivestockPurchase(isOwner, username);
	const { select: selectAnimal, setMessage: setLivestockMessage } = livestock;
	const [fishingOpen, setFishingOpen] = useState(false);
	const [engineReady, setEngineReady] = useState(false);
	const { houseOpen, openHouseMenu, closeHouseMenu } = useHouseMenu(sceneRef);
	const { openFarmTravelMenu, openMarketplaceTravelMenu } = useWorldTravel({
		target,
		username,
		sceneRef,
		marketRef: marketSceneRef,
		engineRef,
	});

	// Names only change on join/leave, so this does not re-render per frame.
	useEffect(() => subscribeHubPeers(setHubPeers), []);
	useEffect(() => subscribeFarmPeers(setFarmPeers), []);

	// The scenes leave the hub when they deactivate; this covers unmounts.
	useEffect(() => () => leaveHub(), []);

	useWorldEngine({
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
	});

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
			closeHouseMenu();
		};
	}, [setPaused, setInventoryOpen, closeHouseMenu]);

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
data-player-x={Math.round(hud.player.x)}
			data-player-y={Math.round(hud.player.y)}
			data-hub-peers={hubPeers.join(",")}
			data-farm-peers={farmPeers.join(",")}
			data-sprinklers={(farm?.sprinklers ?? [])
				.map((s) => `${s.x},${s.y}`)
				.join(";")}
		>
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label={`${area} map. Use WASD or arrow keys to walk.`}
			/>
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
			{bankDesk && (
				<BankWindow desk={bankDesk} isOwner={isOwner} onClose={closeBank} />
			)}
			{travelPrompt && (
				<div className="farm-map-travel-prompt" data-testid="travel-prompt">
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
			{paused && <PauseMenu />}
			{houseOpen && isOwner && farm && (
				<HouseMenu owner={target ?? ""} farm={farm} onClose={closeHouseMenu} />
			)}
			<TravelMenu />
			{fishingOpen && <FishingOverlay onClose={closeFishing} />}
			<CasinoOverlays open={casinoOverlay} onClose={closeCasinoOverlay} />
		</main>
	);
}
