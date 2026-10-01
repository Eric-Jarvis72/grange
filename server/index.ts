import { createServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import ViteExpress from "vite-express";
import { registerSocketHandlers } from "./sockets";
import { state } from "./state";
import { resolveSocketSession, userStore } from "./auth";
import { authRouter } from "./auth/routes";

const RESET_KEY = process.env.RESET_KEY ?? "";

const app = express();
app.use(express.json());

const server = createServer(app);
const io = new Server(server);

// health-check / debug route. Stays unauthenticated: the deploy workflow
// curls it to decide whether a rollout succeeded.
app.get("/api/state", (_req, res) => {
	res.json({
		playerCount: state.players.length,
		gameCount: Object.keys(state.games).length,
	});
});

// Registered before ViteExpress.bind, which is a catch-all and would
// otherwise swallow these routes.
app.use("/api/auth", authRouter(userStore));

// Test hook: wipe in-memory state so e2e runs start clean. Accounts are wiped
// too, so a registration e2e can reuse a fixed username. Guarded because it
// now destroys data rather than just game state.
app.post("/api/reset", (req, res) => {
	if (process.env.NODE_ENV === "production" && req.headers["x-reset-key"] !== RESET_KEY) {
		res.status(403).json({ ok: false, error: "forbidden" });
		return;
	}
	state.players = [];
	state.games = {};
	void userStore.deleteAll();
	res.json({ ok: true });
});

io.use((socket, next) => {
	resolveSocketSession(socket.handshake.headers, socket.data as Record<string, unknown>)
		.then(() => next())
		.catch(next);
});

io.on("connection", (socket) => {
	socket.emit("connected", { ok: true });
});

registerSocketHandlers(io, state);

ViteExpress.bind(app, server);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
	console.log(`Grange running at http://localhost:${PORT}`);
});
