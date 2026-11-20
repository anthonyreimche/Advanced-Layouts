// What activate() registers: the Layout menu section, which takes over the
// menu's saved list, the Layouts window, and a shortcut per workspace.

import { describe, expect, it } from "vitest";
import manifest from "../safelight.json";
import { activate } from "../src/index";
import { EXTENSION_ID, MANAGER_ID, MENU_ID } from "../src/ids";
import { fakeApi } from "./support/fake-api";

describe("activate", () => {
  it("adds a Layout menu section that replaces the menu's saved layouts", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.menus.map((m) => [m.id, m.replacesSavedLayouts])).toEqual([[MENU_ID, true]]);
  });

  it("registers the Layouts window", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.windows.map((w) => [w.id, w.title])).toEqual([[MANAGER_ID, "Layouts"]]);
  });

  it("registers a shortcut for each saved layout already there", () => {
    const rig = fakeApi({ saved: [{ id: "user.a", name: "Culling", modules: {} }] });
    activate(rig.api);
    expect([...rig.keybindings.values()].map((k) => k.label)).toEqual(["Switch to workspace: Culling"]);
  });

  it("names its contributions under the manifest's id", () => {
    expect(EXTENSION_ID).toBe(manifest.id);
    expect(MENU_ID.startsWith(`${manifest.id}.`)).toBe(true);
    expect(MANAGER_ID.startsWith(`${manifest.id}.`)).toBe(true);
  });
});
