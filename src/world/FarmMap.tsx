import * as ex from "excalibur";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth";
import { useGameStore } from "../store";
import { FarmMapScene } from "./FarmMapScene";
import "./farmMap.css";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { resources } from "./resources";

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const username = useGameStore((s) => s.username);
	const navigate = useNavigate();

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

	async function onSignOut() {
		await logout();
		navigate("/", { replace: true });
	}

	return (
		<main className="farm-map-page">
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label="Farm map with buildings, an empty field, paths, trees, and water"
			/>
			<div className="farm-map-bar">
				<span className="farm-map-user" data-testid="farm-map-user">
					{username}
				</span>
				<button
					type="button"
					data-testid="logout"
					onClick={onSignOut}
					className="farm-map-signout"
				>
					Sign out
				</button>
			</div>
		</main>
	);
}
