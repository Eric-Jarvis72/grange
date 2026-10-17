import * as ex from "excalibur";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { FarmToolId } from "../../shared/farm";
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
import { MOVABLE_PROP_ASSETS } from "./mapData";
import { BlackjackOverlay } from "./BlackjackOverlay";
import { CasinoScene } from "./CasinoScene";
import { casinoResources } from "./casinoResources";
import { ComboCounter } from "./ComboCounter";
import { FarmMapScene } from "./FarmMapScene";
import type { FarmHudSnapshot } from "./farmHud";
import "./farmMap.css";
import { MarketplaceScene } from "./MarketplaceScene";
import { MarketWindow } from "./MarketWindow";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { MARKETS } from "./marketData";
import { marketplaceResources } from "./marketplaceResources";
import { PokerOverlay } from "./PokerOverlay";
import { RouletteOverlay } from "./RouletteOverlay";
import { resources } from "./resources";
import { useBarnReconcile } from "./useBarnReconcile";
import { useFarmMarket } from "./useFarmMarket";
import type { WorldArea } from "./WalkingScene";

const worldResources = [
	...new Set([...resources, ...marketplaceResources, ...casinoResources]),
];

const TOOLS: Array<{ id: FarmToolId; label: string; key: string }> = [
	{ id: "hoe", label: "Hoe", key: "1" },
	{ id: "seed", label: "Seeds", key: "2" },
	{ id: "bucket", label: "Bucket", key: "3" },
	{ id: "scythe", label: "Scythe", key: "4" },
];

const TOOL_BY_KEY: Record<string, FarmToolId> = {
	Digit1: "hoe",
	Digit2: "seed",
	Digit3: "bucket",
	Digit4: "scythe",
	Numpad1: "hoe",
	Numpad2: "seed",
	Numpad3: "bucket",
	Numpad4: "scythe",
};

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	useInventoryKeys();
	const sceneRef = useRef<FarmMapScene | null>(null);
	const marketSceneRef = useRef<MarketplaceScene | null>(null);
	const casinoRef = useRef<CasinoScene | null>(null);
	const username = useGameStore((s) => s.username);
	const farm = useGameStore((s) => s.activeFarm);
	const tool = useGameStore((s) => s.tool);
	const setTool = useGameStore((s) => s.setTool);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const setItemCount = useInventoryStore((s) => s.setItemCount);
	const setInventoryOpen = useInventoryStore((s) => s.setInventoryOpen);
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

	// Selecting a hotbar slot drives the active farm tool (the hotbar is the
	// single tool selector). Slots with no tool item leave the tool unchanged.
	useEffect(() => {
		const next = farmToolForItem(hotbar[selectedHotbar]?.itemId ?? null);
		if (next) setTool(next);
	}, [hotbar, selectedHotbar, setTool]);

	// Tell the scene an active slot changed so the combo tracker can grant its
	// one-time chaining grace on the next different action.
	// biome-ignore lint/correctness/useExhaustiveDependencies: fires on slot change by design
	useEffect(() => {
		sceneRef.current?.noteHotbarSwap();
	}, [selectedHotbar]);

	const heldItem = hotbar[selectedHotbar]?.itemId;
	useEffect(() => {
		if (heldItem === "fence") pushNotice("Fence: click clear grass to place a post.", "system");
		if (heldItem === "shovel") pushNotice("Shovel: click a fence or farm object to dig it up.", "system");
		if (heldItem && MOVABLE_PROP_ASSETS.some((asset) => asset === heldItem))
			pushNotice(`Click clear ground to place ${heldItem}.`, "system");
	}, [heldItem, pushNotice]);

	const fenceCount = farm?.fence_count;
	useEffect(() => {
		if (fenceCount !== undefined && isOwner) setItemCount("fence", fenceCount);
	}, [fenceCount, isOwner, setItemCount]);

	const propInventory = farm?.prop_inventory;
	useEffect(() => {
		if (!propInventory || !isOwner) return;
		for (const asset of MOVABLE_PROP_ASSETS)
			setItemCount(asset, propInventory[asset] ?? 0);
	}, [propInventory, isOwner, setItemCount]);

	// Keep the local inventory's produce in sync with the authoritative barn.
	useBarnReconcile(farm?.barn ?? null, isOwner);

	const [area, setArea] = useState<WorldArea>("Farm");
	const [travelPrompt, setTravelPrompt] = useState<string | null>(null);
	const [blackjackOpen, setBlackjackOpen] = useState(false);
	const [pokerOpen, setPokerOpen] = useState(false);
	const [rouletteOpen, setRouletteOpen] = useState(false);
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

		const scene = new FarmMapScene(target, isOwner, setTravelPrompt, setArea);
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
		const casino = new CasinoScene(
			setTravelPrompt,
			setArea,
			() => {
				casino.setPaused(true);
				setBlackjackOpen(true);
			},
			() => {
				casino.setPaused(true);
				setPokerOpen(true);
			},
			() => {
				casino.setPaused(true);
				setRouletteOpen(true);
			},
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
			engine.stop();
			engine.dispose();
		};
	}, [target, isOwner, setMarket, setMarketMessage]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const next = TOOL_BY_KEY[event.code];
			if (next) setTool(next);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setTool]);

	useEffect(() => {
		sceneRef.current?.setTool(tool);
	}, [tool]);

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
		};
	}, [setPaused, setInventoryOpen]);

	function handleCloseMarket() {
		closeMarket();
		marketSceneRef.current?.setPaused(false);
	}

	function closeCasinoOverlay() {
		casinoRef.current?.setPaused(false);
		setBlackjackOpen(false);
		setPokerOpen(false);
		setRouletteOpen(false);
	}

	// The farm channel join is what sets `farm`; until it lands, an action would
	// be dropped by emitFarmAction, so the world isn't interactive yet.
	const worldReady = engineReady && farm !== null;

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
			{market && (
				<MarketWindow
					market={MARKETS[market]}
					controls={itemControls}
					message={marketMessage}
					onClose={handleCloseMarket}
				/>
			)}
			{travelPrompt && (
				<div className="farm-map-travel-prompt" data-testid="travel-prompt">
					{travelPrompt}
				</div>
			)}
			{area === "Farm" && (
				<div className="farm-hud" data-testid="farm-hud">
					{isOwner ? (
						<div
							className="farm-tools"
							role="toolbar"
							aria-label="Farming tools"
						>
							{TOOLS.map((entry) => (
								<button
									key={entry.id}
									type="button"
									data-testid={`tool-${entry.id}`}
									aria-pressed={tool === entry.id}
									className={
										tool === entry.id
											? "farm-tool farm-tool-active"
											: "farm-tool"
									}
									onClick={() => setTool(entry.id)}
								>
									<span className="farm-tool-key">{entry.key}</span>{" "}
									{entry.label}
								</button>
							))}
						</div>
					) : null}
					<div className="farm-status">
						<span data-testid="farm-tomatoes">🍅 {hud.tomatoes}</span>
					</div>
					<p className="farm-hint" data-testid="farm-hint">
						{hud.message}
					</p>
				</div>
			)}
			<Hud tiles={farm?.tiles.length ?? 0} hovered={hud.hovered} />
			<ComboCounter />
			<InventoryPanel />
			{paused && <PauseMenu />}
			{blackjackOpen && <BlackjackOverlay onClose={closeCasinoOverlay} />}
			{pokerOpen && <PokerOverlay onClose={closeCasinoOverlay} />}
			{rouletteOpen && <RouletteOverlay onClose={closeCasinoOverlay} />}
		</main>
	);
}
