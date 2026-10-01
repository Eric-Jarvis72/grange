import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../auth";
import {
	emitCreateGame,
	emitDeleteGame,
	emitJoinGame,
	emitLeaveGame,
	requestGames,
	socket,
} from "../socket";
import { useGameStore } from "../store";

export default function Dashboard() {
	const username = useGameStore((s) => s.username);
	const players = useGameStore((s) => s.players);
	const games = useGameStore((s) => s.games);
	const myGameId = useGameStore((s) => s.myGameId);
	const navigate = useNavigate();

	useEffect(() => {
		// Wait for the socket: after sign-in it is reconnecting with the new
		// session cookie, and emits sent before that would be rejected.
		if (socket.connected) {
			requestGames();
			return;
		}
		socket.once("connect", () => requestGames());
	}, []);

	function onCreate() {
		if (!socket.connected) return;
		emitCreateGame((res) => {
			if (res.ok && res.game) {
				navigate(`/games/${res.game.id}`);
			} else {
				alert(res.error ?? "Could not create game");
			}
		});
	}

	function onJoin(gameId: string) {
		if (!socket.connected) return;
		emitJoinGame(gameId, (res) => {
			if (res.ok && res.game) {
				navigate(`/games/${res.game.id}`);
			} else {
				alert(res.error ?? "Could not join game");
			}
		});
	}

	function onLeave() {
		emitLeaveGame();
	}

	function onDelete(gameId: string) {
		emitDeleteGame(gameId, (res) => {
			if (!res.ok) alert(res.error ?? "Could not delete game");
		});
	}

	async function onLogout() {
		await logout();
		navigate("/", { replace: true });
	}

	function onRejoin() {
		if (myGameId) navigate(`/games/${myGameId}`);
	}

	const myGame = games.find((g) => g.id === myGameId);

	return (
		<div className="mx-auto max-w-3xl p-6">
			<header className="mb-8 flex items-end justify-between">
				<div>
					<h1 className="text-3xl text-barn-red ember-text">DASHBOARD</h1>
					<p className="mt-1 text-sm text-husk">
						Logged in as <span className="text-leaf">{username}</span>
					</p>
				</div>
				<button
					type="button"
					data-testid="logout"
					onClick={onLogout}
					className="text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
				>
					Sign out
				</button>
			</header>

			{myGame && (
				<div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-wheat/50 bg-barn p-4 ember-border text-wheat">
					<p>
						You are in game{" "}
						<strong className="font-display text-sm tracking-wider">
							{myGame.id.slice(0, 8)}
						</strong>
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onRejoin}
							className="rounded border border-wheat/60 bg-wheat/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-wheat transition hover:bg-wheat/20"
						>
							Rejoin
						</button>
						<button
							type="button"
							onClick={onLeave}
							className="rounded border border-pumpkin/60 bg-pumpkin/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-pumpkin transition hover:bg-pumpkin/20"
						>
							Leave
						</button>
					</div>
				</div>
			)}

			<section className="mb-8 rounded-lg border border-plum/40 bg-barn p-5 ember-border text-plum">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-xl text-leaf ember-text">GAMES</h2>
					<button
						type="button"
						onClick={onCreate}
						className="rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow"
					>
						Create Game
					</button>
				</div>

				{games.length === 0 ? (
					<p className="text-sm text-husk">
						No games yet. Create one to get started.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{games.map((g) => (
							<li
								key={g.id}
								className="flex items-center justify-between gap-4 rounded border border-cream/10 bg-barn-deep px-4 py-3"
							>
								<div>
									<Link
										to={`/games/${g.id}`}
										className="font-display text-sm text-leaf hover:underline"
									>
										#{g.id.slice(0, 8)}
									</Link>
									<p className="mt-1 text-xs text-husk">
										{g.players.join(", ") || "no players"} · {g.playerCount}/2
										players · {g.observerCount} observing
									</p>
								</div>
								<div className="flex gap-2">
									{!g.players.includes(username) && (
										<button
											type="button"
											onClick={() => onJoin(g.id)}
											className={`rounded border px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
												g.open
													? "border-leaf/60 bg-leaf/10 text-leaf hover:bg-leaf/20"
													: "border-plum/60 bg-plum/10 text-plum hover:bg-plum/20"
											}`}
										>
											{g.open ? "Join" : "Observe"}
										</button>
									)}
									{g.players.includes(username) && (
										<button
											type="button"
											onClick={() => onDelete(g.id)}
											className="rounded border border-pumpkin/60 bg-pumpkin/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-pumpkin transition hover:bg-pumpkin/20"
										>
											Delete
										</button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="rounded-lg border border-leaf/40 bg-barn p-5 ember-border text-leaf">
				<h2 className="mb-4 text-xl text-barn-red ember-text">PLAYERS</h2>
				{players.length === 0 ? (
					<p className="text-sm text-husk">No players yet.</p>
				) : (
					<ul className="flex flex-col gap-2">
						{players.map((p) => (
							<li
								key={p.name}
								className="flex justify-between rounded border border-cream/10 bg-barn-deep px-4 py-2 text-sm"
							>
								<span>{p.name}</span>
								<span className="text-husk">
									starter + {p.deck.length} cards
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
