/**
 * Shared e2e helpers.
 *
 * The implementation lives in `support/` by concern; this file re-exports it
 * so specs keep one import path and the modules stay under the repo's
 * file-size cap.
 */
export {
	BASE,
	enterFarm,
	login,
	type RegisterFastOptions,
	register,
	registerAccount,
	registerFast,
	TEST_PASSWORD,
	uniqueName,
	waitForWorld,
	worldUrl,
} from "./support/auth";
export {
	clickFarmTile,
	clickWorld,
	farmTilePosition,
	hoverFarmTile,
	worldPoint,
} from "./support/farm";
export {
	enterMarketplace,
	expectArea,
	holdKeys,
	rideTrain,
	sceneLabel,
	TRAVEL_TIMEOUT,
	useDoor,
	waitForTrainStop,
	walkToBank,
	walkToCasino,
	walkToHardwareStore,
	walkToLivestock,
	walkToProduceMarket,
	walkToSeedMarket,
	walkUntilPrompt,
} from "./support/nav";
export {
	farmPeerList,
	hubPeerList,
	waitForFarmPeer,
	waitForFarmPeerGone,
	waitForHubPeer,
	waitForHubPeerGone,
} from "./support/peers";
export { test as multiplayerTest } from "./support/players";
