import * as ex from "excalibur";
import { useEffect, useRef } from "react";
import { Hud } from "../inventory/Hud";
import { InventoryPanel } from "../inventory/InventoryPanel";
import "../inventory/inventory.css";
import { useInventoryKeys } from "../inventory/useInventoryKeys";
import { FarmMapScene } from "./FarmMapScene";
import "./farmMap.css";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { resources } from "./resources";

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	useInventoryKeys();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let cancelled = false;
		const engine = new ex.Engine({
			canvasElement: canvas,
			viewport: { width: MAP_WIDTH, height: MAP_HEIGHT },
			resolution: { width: MAP_WIDTH, height: MAP_HEIGHT },
			displayMode: ex.DisplayMode.FitContainer,
			pixelArt: true,
			suppressConsoleBootMessage: true,
			backgroundColor: ex.Color.fromHex("#79a44d"),
		});

		engine.addScene("farm-map", new FarmMapScene());
		void Promise.all(resources.map((resource) => resource.load())).then(
			async () => {
				if (cancelled) return;
				await engine.start();
				if (!cancelled) await engine.goToScene("farm-map");
			},
		);

		return () => {
			cancelled = true;
			engine.stop();
			engine.dispose();
		};
	}, []);

	return (
		<main className="farm-map-page">
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label="Farm map with buildings, an empty field, paths, trees, and water"
			/>
			<Hud />
			<InventoryPanel />
		</main>
	);
}
