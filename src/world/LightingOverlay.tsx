import type * as ex from "excalibur";
import { useEffect, useRef } from "react";
import { useGameStore } from "../store";
import { LightingLayer } from "./lightingLayer";
import { getLightSources } from "./lightSources";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import type { WorldArea } from "./WalkingScene";

interface LightingOverlayProps {
	engine: ex.Engine | null;
	area: WorldArea;
	gameCanvasRef: { current: HTMLCanvasElement | null };
}

/** A full-screen canvas overlay that tints the world for the current phase. */
export function LightingOverlay({
	engine,
	area,
	gameCanvasRef,
}: LightingOverlayProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!engine || !canvas) return;
		const layer = new LightingLayer(canvas, {
			resolution: { width: MAP_WIDTH, height: MAP_HEIGHT },
			getGameCanvas: () => gameCanvasRef.current,
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
	}, [engine, area, gameCanvasRef]);

	return <canvas ref={canvasRef} className="farm-map-lighting-canvas" />;
}
