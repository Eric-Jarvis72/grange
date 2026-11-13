import * as ex from "excalibur";
import type { HubArea } from "../../shared/types";
import { useGameStore } from "../store";
import { depthForY } from "./depth";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import { FrameClock } from "./frameClock";
import {
	getHubPeers,
	joinHub,
	leaveHub,
	publishHubPosition,
} from "./hubClient";
import { HubPlayers } from "./hubPlayers";
import { InputManager } from "./InputManager";
import { MAX_INTERACTION_DISTANCE } from "./interaction";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { updateWalkingPlayer } from "./playerMovement";
import type { WalkObstacle } from "./walkCollisions";
import { ensureSceneResources } from "./worldAssets";

export type WorldArea =
	| "Farm"
	| "Marketplace"
	| "Casino"
	| "Livestock Market"
	| "Bank";
export type WorldSceneName =
	| "farm-map"
	| "marketplace"
	| "casino"
	| "livestock-market"
	| "bank";

export interface SceneSpawn {
	x: number;
	y: number;
}

export interface SceneInteraction {
	position: ex.Vector;
	prompt: string;
	/** How close the player must stand for the prompt to show. Defaults to
	 * MAX_INTERACTION_DISTANCE; large objects may declare a wider reach. */
	radius?: number;
	/** Controls whether the prompt shows; omit to always allow. */
	canInteract?: () => boolean;
	/** Travel to another scene when pressed. Omit for an in-place action. */
	destination?: WorldSceneName;
	destinationSpawn?: SceneSpawn;
	/** When true, the destination's train plays its arrival animation. */
	trainArriving?: boolean;
	/** Runs after the interaction starts but before scene travel, e.g. to play
	 * the train's departure animation. */
	onTravel?: () => Promise<void>;
	/** Runs instead of scene travel when the interaction is triggered. */
	action?: () => void;
}

export interface SceneActivationData {
	spawn?: SceneSpawn;
	/** Set by a train trip so the arriving scene slides the train in. */
	trainArriving?: boolean;
}

interface WalkingSceneOptions {
	area: WorldArea;
	spawn: ex.Vector;
	interactions: SceneInteraction[];
	obstacles: WalkObstacle[];
	/** Shared hub areas show other players; leave unset for private scenes. */
	hubArea?: HubArea | null;
	onAreaChange: (area: WorldArea) => void;
	onPromptChange: (prompt: string | null) => void;
	worldWidth?: number;
}

export abstract class WalkingScene extends ex.Scene<SceneActivationData> {
	protected player!: ex.Actor;
	protected inputManager?: InputManager;
	private activePrompt: string | null = null;
	private traveling = false;
	private paused = false;
	private hubPlayers?: HubPlayers;
	private readonly playerSpeed = 160;
	/** Wall-clock gameplay step; see `frameClock.ts`. */
	protected readonly frameClock = new FrameClock();

	constructor(private readonly options: WalkingSceneOptions) {
		super();
	}

	protected addPlayer(): void {
		this.player = new ex.Actor({
			pos: this.options.spawn.clone(),
			width: 32,
			height: 32,
			anchor: ex.vec(0.5, 1),
			z: depthForY(this.options.spawn.y),
		});
		addFarmerGraphics(this.player);
		this.add(this.player);
		if (this.options.hubArea) {
			const username = useGameStore.getState().username;
			this.hubPlayers = new HubPlayers(this, this.player, username || "Farmer");
		}
		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
	}

	override onActivate(
		context: ex.SceneActivationContext<SceneActivationData>,
	): void {
		const spawn = context.data?.spawn;
		this.player.pos = spawn
			? ex.vec(spawn.x, spawn.y)
			: this.options.spawn.clone();
		this.inputManager = new InputManager();
		this.traveling = false;
		this.paused = false;
		this.frameClock.reset();
		this.options.onAreaChange(this.options.area);
		this.setPrompt(null);
		if (this.options.hubArea) {
			joinHub(this.options.hubArea);
			this.hubPlayers?.sync(getHubPeers());
			publishHubPosition(this.player.pos.x, this.player.pos.y);
		}
	}

	/** Freezes movement and input while a DOM overlay owns the screen. */
	setPaused(paused: boolean): void {
		if (this.paused === paused) return;
		this.paused = paused;
		if (paused) {
			this.inputManager?.destroy();
			this.inputManager = undefined;
			this.player.vel = ex.Vector.Zero;
			this.setPrompt(null);
		} else {
			this.inputManager = new InputManager();
		}
	}

	/** Syncs and eases remote avatars; subclasses may call it before returning. */
	protected updateHub(delta: number): void {
		this.hubPlayers?.sync(getHubPeers());
		this.hubPlayers?.update(delta);
	}

	override onPreUpdate(engine: ex.Engine, _delta: number): void {
		this.walkFrame(engine, this.frameClock.step());
	}

	/**
	 * Runs one walking frame with a wall-clock step. Split out so a subclass
	 * that also animates something (the marketplace train) can take a single
	 * step for the frame instead of advancing each concern separately.
	 */
	protected walkFrame(engine: ex.Engine, step: number): void {
		// Other players keep moving while a DOM overlay pauses the local player.
		this.updateHub(step);

		if (!this.inputManager || this.paused) return;
		// Freeze the player while a travel animation (the train leaving) plays.
		if (this.traveling) {
			this.player.vel = ex.Vector.Zero;
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			return;
		}
		const direction = this.inputManager.getMovementVector();
		updateWalkingPlayer(
			this.player,
			direction,
			this.playerSpeed,
			step,
			this.options.obstacles,
			this.options.worldWidth,
		);
		if (this.options.worldWidth && this.options.worldWidth > MAP_WIDTH)
			this.camera.pos = ex.vec(
				ex.clamp(
					this.player.pos.x,
					MAP_WIDTH / 2,
					this.options.worldWidth - MAP_WIDTH / 2,
				),
				MAP_HEIGHT / 2,
			);
		updateFarmerGraphics(this.player, direction);
		if (this.options.hubArea) {
			publishHubPosition(this.player.pos.x, this.player.pos.y);
		}

		const interaction = this.options.interactions.find(
			(candidate) =>
				(candidate.canInteract?.() ?? true) &&
				this.player.pos.distance(candidate.position) <=
					(candidate.radius ?? MAX_INTERACTION_DISTANCE),
		);
		this.setPrompt(interaction?.prompt ?? null);
		if (interaction && this.inputManager.consumePress("KeyE", "Enter")) {
			this.setPrompt(null);
			if (interaction.action) {
				interaction.action();
				return;
			}
			if (!interaction.destination) return;
			this.traveling = true;
			void this.travelTo(engine, interaction);
		}
	}

	/** Plays any pre-travel animation, then hands off to the destination scene. */
	private async travelTo(
		engine: ex.Engine,
		interaction: SceneInteraction,
	): Promise<void> {
		if (!interaction.destination) {
			if (interaction.onTravel) await interaction.onTravel();
			return;
		}
		// Warm the destination while the departure animation plays, so a fast
		// player never lands in a scene whose art has not loaded yet.
		const assets = ensureSceneResources(interaction.destination);
		if (interaction.onTravel) await interaction.onTravel();
		await assets;
		await engine.goToScene(interaction.destination, {
			sceneActivationData: {
				spawn: interaction.destinationSpawn,
				trainArriving: interaction.trainArriving,
			},
		});
	}

	override onDeactivate(): void {
		this.player.vel = ex.Vector.Zero;
		this.inputManager?.destroy();
		this.inputManager = undefined;
		this.setPrompt(null);
		this.hubPlayers?.clear();
		if (this.options.hubArea) leaveHub();
	}

	private setPrompt(prompt: string | null): void {
		if (prompt === this.activePrompt) return;
		this.activePrompt = prompt;
		this.options.onPromptChange(prompt);
	}
}
