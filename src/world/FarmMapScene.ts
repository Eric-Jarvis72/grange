import * as ex from "excalibur";
import { InputManager } from "./InputManager";
import {
    MAP_COLUMNS,
    MAP_HEIGHT,
    MAP_ROWS,
    MAP_WIDTH,
    TILE_SIZE,
    props,
    terrainAt,
} from "./mapData";
import { propImages, terrainFrames, terrainImage } from "./resources";

export class FarmMapScene extends ex.Scene {
    private inputManager!: InputManager;
    private player!: ex.Actor;
    private readonly playerSpeed = 160; // Pixels per second

    override onInitialize(): void {
        this.backgroundColor = ex.Color.fromHex("#79a44d");

        // 1. Initialize standalone input listener
        this.inputManager = new InputManager();

        // 2. Build Terrain TileMap
        const sheet = ex.SpriteSheet.fromImageSource({
            image: terrainImage,
            grid: {
                rows: 4,
                columns: 4,
                spriteWidth: TILE_SIZE,
                spriteHeight: TILE_SIZE,
            },
        });

        const terrain = new ex.TileMap({
            pos: ex.vec(0, 0),
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE,
            columns: MAP_COLUMNS,
            rows: MAP_ROWS,
            renderFromTopOfGraphic: true,
        });

        for (let row = 0; row < MAP_ROWS; row += 1) {
            for (let column = 0; column < MAP_COLUMNS; column += 1) {
                const frame = terrainFrames[terrainAt(column, row)];
                terrain
                    .getTile(column, row)
                    ?.addGraphic(sheet.getSprite(frame.column, frame.row));
            }
        }
        this.add(terrain);

        // 3. Populate Props
        for (const prop of props) {
            const source = propImages[prop.asset];
            const sprite = source.toSprite();
            const scale = prop.width / source.width;
            sprite.scale = ex.vec(scale, scale);

            const actor = new ex.Actor({
                pos: ex.vec(prop.x, prop.y),
                anchor: ex.vec(0.5, 1),
                z: 100 + Math.floor(prop.y),
            });
            actor.graphics.use(sprite);
            this.add(actor);
        }

        // 4. Create Player Actor
        this.player = new ex.Actor({
            pos: ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2),
            width: 32,
            height: 32,
            color: ex.Color.fromHex("#ffcc00"), // Yellow box placeholder or attach player sprite
            anchor: ex.vec(0.5, 1),
            z: 200,
        });
        this.add(this.player);

        // Center camera initially
        this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    }

    override onPreUpdate(_engine: ex.Engine, _delta: number): void {
        // Poll input vector (normalized -1 to 1)
        const dir = this.inputManager.getMovementVector();

        // Excalibur automatically applies delta-time to actor.vel
        this.player.vel = ex.vec(dir.x * this.playerSpeed, dir.y * this.playerSpeed);

        // Update player z-index based on Y position for depth sorting with props
        this.player.z = 100 + Math.floor(this.player.pos.y);

        // Clamp player inside map boundaries
        this.player.pos.x = Math.max(16, Math.min(MAP_WIDTH - 16, this.player.pos.x));
        this.player.pos.y = Math.max(32, Math.min(MAP_HEIGHT, this.player.pos.y));

        // Smoothly lock camera to player
        this.camera.pos = this.player.pos;
    }

    override onDeactivate(): void {
        // Clean up DOM listeners when scene changes or unmounts
        this.inputManager?.destroy();
    }
}