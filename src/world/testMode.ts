import type { WorldSceneName } from "./WalkingScene";

/**
 * Areas the world route may boot straight into during end-to-end runs.
 *
 * `farm-map` is the normal start and is included so the query parameter can be
 * used to force it after a previous test left an arrival flag behind.
 */
const STARTABLE_AREAS: readonly WorldSceneName[] = [
	"farm-map",
	"marketplace",
	"casino",
	"livestock-market",
	"bank",
];

/**
 * E2E hooks are compiled into dev builds only: the Phoenix shell injects a
 * `grange-test-routes` meta tag when `enable_test_routes` is on, which mirrors
 * the compile-time guard around the `/api/reset` route. Production releases
 * never see the tag, so these helpers stay inert there.
 */
const enabled =
	typeof document !== "undefined" &&
	document
		.querySelector('meta[name="grange-test-routes"]')
		?.getAttribute("content") === "true";

/**
 * Gameplay-speed hooks are narrower than the test routes: a regular dev
 * session still gets `/api/reset` and `?area=`, but only an actual Playwright
 * run should walk faster and play shortened animations. The e2e web server
 * sets `GRANGE_E2E=1`, which injects this second tag.
 */
const e2e =
	typeof document !== "undefined" &&
	document.querySelector('meta[name="grange-e2e"]')?.getAttribute("content") ===
		"true";

/** True when the dev-only e2e hooks are available. */
export function testMode(): boolean {
	return enabled;
}

/**
 * The scene the world should boot into, from `?area=`, or null.
 *
 * Only honored in test mode; a production player always starts on the farm.
 */
export function requestedStartArea(): WorldSceneName | null {
	if (!enabled || typeof window === "undefined") return null;
	const area = new URLSearchParams(window.location.search).get("area");
	if (!area) return null;
	return STARTABLE_AREAS.includes(area as WorldSceneName)
		? (area as WorldSceneName)
		: null;
}

/**
 * Whether this page asked to walk at production speed with `?walk=normal`.
 *
 * A spec opts out when it has to *read* a prompt that is only on screen for a
 * frame or two at the 3x speed, where the prompt DOM can lag a frame behind and
 * skip the text entirely.
 */
function requestedNormalWalk(): boolean {
	if (!enabled || typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("walk") === "normal";
}

/**
 * Multiplier applied to walking speed in all world scenes. Playwright runs walk
 * three times as fast so navigation-heavy specs stay quick; normal development
 * and production play are unchanged. The e2e helper polls 40ms apart, so a 3x
 * walk still stops well inside the default 115px interaction radius. Anything
 * narrower (the farmhand's 90px radius, for one) is crossed in about a frame,
 * so those specs ask for `?walk=normal` and check the prompt at production
 * speed.
 */
export const WALK_SPEED_MULTIPLIER = e2e && !requestedNormalWalk() ? 3 : 1;

/**
 * Picks the e2e timing for an animation or wait: `fast` in an e2e run, `real`
 * in normal play.
 *
 * Only the wall-clock animations and periodic sweeps use this — never a rule
 * the server owns (growth, decay, combo windows). A spec that asserts a
 * transient "spinning" label instead of the settled result would race against
 * these shorter values.
 */
export function e2eMs(real: number, fast: number): number {
	return e2e ? fast : real;
}
