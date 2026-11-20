// The controller: module layouts and workspaces over Safelight's layouts API.

import { describe, expect, it } from "vitest";
import type { ModuleLayoutDef, SavedLayout } from "../src/safelight";
import { createController } from "../src/controller";
import { fakeApi } from "./support/fake-api";

const grid: ModuleLayoutDef = { rails: [{ side: "left", width: 260, panels: ["core.folders"] }] };
const filmstrip: ModuleLayoutDef = { rails: [{ side: "bottom", height: 110, panels: ["core.filmstrip"] }] };
const minimal: ModuleLayoutDef = { rails: [{ side: "right", width: 300, panels: ["core.basic"] }] };
const raw: ModuleLayoutDef = { rails: [{ side: "right", width: 320, panels: ["core.basic", "core.detail"] }] };
const MODULES = ["library", "develop"];

function setup(saved: SavedLayout[] = []) {
  const rig = fakeApi({ docks: { library: grid, develop: minimal }, saved });
  const c = createController(rig.api);
  return { rig, c };
}

const names = (c: ReturnType<typeof setup>["c"], module: string) => c.state().modules[module]?.map((l) => l.name);

describe("saved layouts from before", () => {
  it("become workspaces whose arrangements are module layouts named after them", () => {
    const { c } = setup([
      { id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } },
      { id: "user.b", name: "RAW editing", modules: { library: filmstrip, develop: raw } },
    ]);
    expect(c.workspaces().map((w) => w.name)).toEqual(["Culling", "RAW editing"]);
    expect(names(c, "library")).toEqual(["Culling", "RAW editing"]);
    expect(names(c, "develop")).toEqual(["Culling", "RAW editing"]);
  });
});

describe("module layouts", () => {
  it("saves the current module's arrangement under a name and shows it unmodified", () => {
    const { c } = setup();
    const id = c.saveModuleLayoutAs("develop", "Minimal");
    expect(c.state().modules.develop).toEqual([{ id, name: "Minimal", def: minimal }]);
    expect(c.showing("develop")?.name).toBe("Minimal");
    expect(c.modified("develop")).toBe(false);
  });

  it("reads as modified once the dock is edited", () => {
    const { rig, c } = setup();
    c.saveModuleLayoutAs("develop", "Minimal");
    rig.edit(raw);
    expect(c.modified("develop")).toBe(true);
  });

  it("applies a module layout to the current module", () => {
    const { rig, c } = setup();
    c.saveModuleLayoutAs("develop", "Minimal");
    rig.edit(raw);
    const rawId = c.saveModuleLayoutAs("develop", "RAW");
    const minimalId = c.state().modules.develop[0].id;
    c.applyModuleLayout("develop", minimalId);
    expect(rig.docks.develop).toEqual(minimal);
    expect(c.showing("develop")?.id).toBe(minimalId);
    expect(rawId).not.toBe(minimalId);
  });

  it("under a workspace, a module layout applied becomes the workspace's pick for that module", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } }]);
    c.applyWorkspace("user.a");
    rig.edit(raw);
    const rawId = c.saveModuleLayoutAs("develop", "RAW");
    c.applyWorkspace("user.a");
    c.applyModuleLayout("develop", rawId);
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
    expect(c.state().parts["user.a"].develop).toBe(rawId);
    expect(c.activeWorkspace()).toBe("user.a");
  });

  it("Update writes the dock into the module layout and every workspace built from it", () => {
    const { rig, c } = setup([
      { id: "user.a", name: "Culling", modules: { develop: minimal } },
      { id: "user.b", name: "Quick", modules: { develop: minimal } },
    ]);
    c.applyWorkspace("user.a");
    rig.edit(raw);
    const part = c.showing("develop")!;
    c.updateModuleLayout("develop", part.id);
    expect(c.state().modules.develop.find((l) => l.id === part.id)?.def).toEqual(raw);
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
    expect(rig.saved()["user.b"].modules.develop).toEqual(raw);
    expect(c.modified("develop")).toBe(false);
  });

  it("Update picks the edited workspace again, so it no longer reads as Custom", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } }]);
    c.applyWorkspace("user.a");
    rig.edit(raw);
    expect(rig.api.stores.useLayoutStore.getState()).toMatchObject({ activeId: "custom", editedFrom: "user.a" });
    c.updateModuleLayout("develop", c.showing("develop")!.id);
    expect(rig.api.stores.useLayoutStore.getState().activeId).toBe("user.a");
  });

  it("Revert shows the module layout again", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } }]);
    c.applyWorkspace("user.a");
    rig.edit(raw);
    c.revertModule("develop");
    expect(rig.docks.develop).toEqual(minimal);
    expect(c.modified("develop")).toBe(false);
    expect(rig.api.stores.useLayoutStore.getState().activeId).toBe("user.a");
  });

  it("renames, keeping names unique in the module", () => {
    const { rig, c } = setup();
    const a = c.saveModuleLayoutAs("develop", "Minimal");
    rig.edit(raw);
    c.saveModuleLayoutAs("develop", "RAW");
    c.renameModuleLayout("develop", a, "RAW");
    expect(names(c, "develop")).toEqual(["RAW 2", "RAW"]);
  });

  it("duplicates and reorders", () => {
    const { c } = setup();
    const a = c.saveModuleLayoutAs("develop", "Minimal");
    const copy = c.duplicateModuleLayout("develop", a);
    expect(names(c, "develop")).toEqual(["Minimal", "Minimal 2"]);
    c.moveModuleLayout("develop", copy, -1);
    expect(names(c, "develop")).toEqual(["Minimal 2", "Minimal"]);
  });

  it("deleting one leaves the workspaces built from it their arrangement", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { develop: minimal } }]);
    c.renameModuleLayout("develop", c.state().modules.develop[0].id, "Minimal");
    c.deleteModuleLayout("develop", c.state().modules.develop[0].id);
    expect(rig.saved()["user.a"].modules.develop).toEqual(minimal);
    expect(names(c, "develop")).toEqual(["Culling"]);
  });
});

describe("workspaces", () => {
  it("saves the current view as a workspace built from the module layouts showing", () => {
    const { rig, c } = setup();
    const minimalId = c.saveModuleLayoutAs("develop", "Minimal");
    const id = c.saveWorkspaceAs("Culling", MODULES);
    expect(rig.saved()[id]).toMatchObject({ name: "Culling", modules: { library: grid, develop: minimal } });
    expect(c.state().parts[id].develop).toBe(minimalId);
    expect(names(c, "library")).toEqual(["Culling"]);
    expect(c.activeWorkspace()).toBe(id);
  });

  it("is marked edited while the dock differs from it", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { develop: minimal } }]);
    c.applyWorkspace("user.a");
    expect(c.workspaceEdited("user.a")).toBe(false);
    rig.edit(raw);
    expect(c.activeWorkspace()).toBe("user.a");
    expect(c.workspaceEdited("user.a")).toBe(true);
  });

  it("picks a module layout for a module", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { develop: minimal } }]);
    rig.edit(raw);
    const rawId = c.saveModuleLayoutAs("develop", "RAW");
    c.setPart("user.a", "develop", rawId);
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
    c.setPart("user.a", "develop", null);
    expect(rig.saved()["user.a"].modules.develop).toBeUndefined();
  });

  it("updates from the current view", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { develop: minimal } }]);
    rig.edit(raw);
    c.updateWorkspace("user.a", MODULES);
    expect(rig.saved()["user.a"].modules).toEqual({ library: grid, develop: raw });
  });

  it("renames, duplicates beside the original, reorders and deletes", () => {
    const { rig, c } = setup([
      { id: "user.a", name: "Culling", modules: { develop: minimal } },
      { id: "user.b", name: "RAW editing", modules: { develop: raw } },
    ]);
    c.renameWorkspace("user.a", "Cull");
    const copy = c.duplicateWorkspace("user.a");
    expect(c.workspaces().map((w) => w.name)).toEqual(["Cull", "Cull 2", "RAW editing"]);
    expect(c.state().parts[copy]).toEqual(c.state().parts["user.a"]);
    c.moveWorkspace("user.b", -2);
    expect(c.workspaces().map((w) => w.name)).toEqual(["RAW editing", "Cull", "Cull 2"]);
    c.deleteWorkspace(copy);
    expect(rig.saved()[copy]).toBeUndefined();
    expect(c.workspaces().map((w) => w.name)).toEqual(["RAW editing", "Cull"]);
  });

  it("has a shortcut per workspace that picks it, and none once deleted", () => {
    const { rig, c } = setup([{ id: "user.a", name: "Culling", modules: { develop: minimal } }]);
    c.syncShortcuts();
    const action = rig.keybindings.get(c.shortcutId("user.a"));
    expect(action?.label).toBe("Switch to workspace: Culling");
    rig.edit(raw);
    action?.handler();
    expect(rig.docks.develop).toEqual(minimal);
    c.deleteWorkspace("user.a");
    expect(rig.keybindings.has(c.shortcutId("user.a"))).toBe(false);
  });
});

describe("the layouts file", () => {
  it("imports what another install exported, beside what is there", () => {
    const from = setup([
      { id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } },
    ]).c.exportText();
    const { rig, c } = setup([{ id: "user.z", name: "Mine", modules: { develop: raw } }]);
    const added = c.importText(from);
    expect(added).toEqual({ workspaces: 1, moduleLayouts: 2 });
    const culling = Object.values(rig.saved()).find((s) => s.name === "Culling")!;
    expect(culling.modules).toEqual({ library: grid, develop: minimal });
    expect(c.workspaces().map((w) => w.name)).toEqual(["Mine", "Culling"]);
  });

  it("refuses text that isn't a layouts file", () => {
    const { c } = setup();
    expect(() => c.importText("{")).toThrow(/layouts file/);
  });
});
