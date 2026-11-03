import { useEffect, useRef } from "react";
import type * as ex from "excalibur";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { LightingLayer } from "./lightingLayer";
import { getLightSources } from "./lightSources";
import { useGameStore } from "../store";
import type { WorldArea } from "./WalkingScene";

interface LightingOverlayProps {
	engine: ex.Engine | null;
	area: WorldArea;
	getGameCanvas: () => HTMLCanvasElement | null;
}

/** A full-screen canvas overlay that tints the world for the current phase. */
export function LightingOverlay({
	engine,
	area,
	getGameCanvas,
}: LightingOverlayProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!engine || !canvas) return;
		const layer = new LightingLayer(canvas, {
			resolution: { width: MAP_WIDTH, height: MAP_HEIGHT },
			getGameCanvas,
			getTime: () => useGameStore.getState().worldTime,
			getCamera: () => {
				const camera = engine.currentScene?.camera;
				if (!camera) return null;
				return { x: camera.drawPos.x, y: camera.drawPos.y, zoom: camera.zoom };
			},
			getLightSources: () =>
				getLightSources(area, useGameStore.getState().activeFarm),
		});
		layer.start();
		return () => layer.stop();
	}, [engine, area, getGameCanvas]);

	return (
		<canvas ref={canvasRef} className="farm-map-lighting-canvas" />
	);
}
