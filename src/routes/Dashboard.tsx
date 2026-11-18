import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../auth";
import { requestFarms } from "../socket";
import { useGameStore } from "../store";

export default function Dashboard() {
	const username = useGameStore((s) => s.username);
	const players = useGameStore((s) => s.players);
	const farms = useGameStore((s) => s.farms);
	const navigate = useNavigate();

	useEffect(() => {
		requestFarms();
	}, []);

	const mine = farms.find((f) => f.owner === username);
	const others = farms.filter((f) => f.owner !== username && f.is_public);

	async function onLogout() {
		await logout();
		navigate("/", { replace: true });
	}

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

			<section className="mb-8 rounded-lg border border-leaf/40 bg-barn p-5 ember-border text-leaf">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-xl text-leaf ember-text">YOUR FARM</h2>
					<Link
						to="/world"
						className="rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow"
					>
						Go to field
					</Link>
				</div>
				{mine ? (
					<p className="text-sm text-cream">
						{mine.tiles} tilled · {mine.planted} growing · {mine.ready} ready ·{" "}
						{mine.tomatoes} tomatoes
					</p>
				) : (
					<p className="text-sm text-husk">Preparing your farm…</p>
				)}
			</section>

			<section className="mb-8 rounded-lg border border-plum/40 bg-barn p-5 ember-border text-plum">
				<h2 className="mb-4 text-xl text-barn-red ember-text">OTHER FARMS</h2>
				{others.length === 0 ? (
					<p className="text-sm text-husk">
						No other farms yet. Invite a friend to register.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{others.map((f) => (
							<li
								key={f.owner}
								className="flex items-center justify-between gap-4 rounded border border-cream/10 bg-barn-deep px-4 py-3"
							>
								<div>
									<p className="font-display text-sm text-leaf">{f.owner}</p>
									<p className="mt-1 text-xs text-husk">
										{f.tiles} tilled · {f.planted} growing · {f.ready} ready
									</p>
								</div>
								<button
									type="button"
									onClick={() => navigate(`/farms/${f.owner}`)}
									className="rounded border border-plum/60 bg-plum/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-plum transition hover:bg-plum/20"
								>
									Visit
								</button>
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
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
