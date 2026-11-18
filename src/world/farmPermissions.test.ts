import { describe, expect, it } from "vitest";
import { canEditFarm } from "./farmPermissions";

describe("canEditFarm", () => {
	it("always lets the owner edit", () => {
		expect(canEditFarm({ visitor_edit: false }, true)).toBe(true);
		expect(canEditFarm({ visitor_edit: true }, true)).toBe(true);
	});

	it("lets a visitor edit only while the owner allows it", () => {
		expect(canEditFarm({ visitor_edit: true }, false)).toBe(true);
		expect(canEditFarm({ visitor_edit: false }, false)).toBe(false);
	});

	it("treats a missing farm as read-only for visitors", () => {
		expect(canEditFarm(null, false)).toBe(false);
		expect(canEditFarm(undefined, false)).toBe(false);
	});
});
