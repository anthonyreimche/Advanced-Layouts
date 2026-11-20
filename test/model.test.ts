// The pure model: comparing arrangements, keeping the workspaces' parts in
// step with Safelight's saved layouts, and the layouts file.

import { describe, expect, it } from "vitest";
import type { ModuleLayoutDef } from "../src/safelight";
import {
  EMPTY_STATE,
  addModuleLayout,
  drifted,
  exportFile,
  importFile,
  reconcile,
  sameDef,
  type LayoutsState,
  type SavedLayout,
} from "../src/model";

const grid: ModuleLayoutDef = { rails: [{ side: "left", width: 260, panels: ["core.folders"] }] };
const minimal: ModuleLayoutDef = { rails: [{ side: "right", width: 300, panels: ["core.basic"] }] };
const raw: ModuleLayoutDef = { rails: [{ side: "right", width: 320, panels: ["core.basic", "core.detail"] }] };

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

describe("sameDef", () => {
  it("ignores a width moved by less than a pixel", () => {
    expect(sameDef(grid, { rails: [{ side: "left", width: 260.4, panels: ["core.folders"] }] })).toBe(true);
  });

  it("sees a panel moved to another rail", () => {
    expect(sameDef(minimal, { rails: [{ side: "left", width: 300, panels: ["core.basic"] }] })).toBe(false);
  });

  it("sees a panel reordered in its rail", () => {
    const swapped = { rails: [{ side: "right" as const, width: 320, panels: ["core.detail", "core.basic"] }] };
    expect(sameDef(raw, swapped)).toBe(false);
  });

  it("ignores the order of the collapsed list", () => {
    expect(sameDef({ ...raw, collapsed: ["core.basic", "core.detail"] }, { ...raw, collapsed: ["core.detail", "core.basic"] })).toBe(true);
  });

  it("treats no floating panels and an empty floating record alike", () => {
    expect(sameDef(raw, { ...raw, floating: {} })).toBe(true);
  });

  it("sees a floating window moved", () => {
    const a = { ...raw, floating: { "x.p": { x: 10, y: 10, width: 200 } } };
    const b = { ...raw, floating: { "x.p": { x: 40, y: 10, width: 200 } } };
    expect(sameDef(a, b)).toBe(false);
  });
});

describe("reconcile", () => {
  it("splits a saved layout without parts into module layouts named after it", () => {
    const saved: SavedLayout[] = [{ id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } }];
    const { state } = reconcile(EMPTY_STATE, saved, ids());
    expect(state.modules.library).toEqual([{ id: "id1", name: "Culling", def: grid }]);
    expect(state.modules.develop).toEqual([{ id: "id2", name: "Culling", def: minimal }]);
    expect(state.parts["user.a"]).toEqual({ library: "id1", develop: "id2" });
    expect(state.order).toEqual(["user.a"]);
  });

  it("links a part to a module layout with the same arrangement instead of copying it", () => {
    const saved: SavedLayout[] = [
      { id: "user.a", name: "Culling", modules: { develop: minimal } },
      { id: "user.b", name: "Quick", modules: { develop: minimal } },
    ];
    const { state } = reconcile(EMPTY_STATE, saved, ids());
    expect(state.modules.develop).toHaveLength(1);
    expect(state.parts["user.b"]).toEqual({ develop: "id1" });
  });

  it("leaves a module layout alone when Safelight changed a workspace built from it", () => {
    const start: LayoutsState = {
      modules: { develop: [{ id: "m1", name: "RAW", def: raw }] },
      parts: { "user.a": { develop: "m1" } },
      order: ["user.a"],
    };
    const saved: SavedLayout[] = [{ id: "user.a", name: "A", modules: { develop: minimal } }];
    const { state } = reconcile(start, saved, ids());
    expect(state.modules.develop).toEqual([{ id: "m1", name: "RAW", def: raw }]);
    expect(state.parts["user.a"]).toEqual({ develop: "m1" });
    expect(drifted(state, saved[0], "develop")).toBe(true);
  });

  it("settles: a second pass changes nothing", () => {
    const saved: SavedLayout[] = [
      { id: "user.a", name: "A", modules: { develop: minimal, library: grid } },
      { id: "user.b", name: "B", modules: { develop: raw } },
    ];
    const first = reconcile(EMPTY_STATE, saved, ids());
    expect(reconcile(first.state, saved, ids()).state).toEqual(first.state);
  });

  it("gives the module layouts it makes the same ids in every window", () => {
    const saved: SavedLayout[] = [{ id: "user.a", name: "A", modules: { develop: raw } }];
    expect(reconcile(EMPTY_STATE, saved).state).toEqual(reconcile(EMPTY_STATE, saved).state);
    expect(reconcile(EMPTY_STATE, saved).state.parts["user.a"]).toEqual({ develop: "user.a:develop" });
  });

  it("forgets a workspace deleted in Preferences, and keeps its module layouts", () => {
    const start: LayoutsState = {
      modules: { develop: [{ id: "m1", name: "RAW", def: raw }] },
      parts: { "user.a": { develop: "m1" } },
      order: ["user.a"],
    };
    const { state } = reconcile(start, [], ids());
    expect(state.parts).toEqual({});
    expect(state.order).toEqual([]);
    expect(state.modules.develop).toHaveLength(1);
  });

  it("drops a part whose module layout was deleted, so the next pass links it again", () => {
    const start: LayoutsState = { modules: {}, parts: { "user.a": { develop: "gone" } }, order: ["user.a"] };
    const { state } = reconcile(start, [{ id: "user.a", name: "A", modules: { develop: raw } }], ids());
    expect(state.modules.develop).toEqual([{ id: "id1", name: "A", def: raw }]);
    expect(state.parts["user.a"]).toEqual({ develop: "id1" });
  });

  it("keeps the order and puts new workspaces at the end", () => {
    const start: LayoutsState = { modules: {}, parts: { "user.b": {} }, order: ["user.b"] };
    const saved: SavedLayout[] = [
      { id: "user.a", name: "A", modules: {} },
      { id: "user.b", name: "B", modules: {} },
    ];
    expect(reconcile(start, saved, ids()).state.order).toEqual(["user.b", "user.a"]);
  });
});

describe("addModuleLayout", () => {
  it("numbers a name already taken in that module", () => {
    let s = addModuleLayout(EMPTY_STATE, "develop", "RAW", raw, "a").state;
    const { state, id } = addModuleLayout(s, "develop", "RAW", minimal, "b");
    s = state;
    expect(id).toBe("b");
    expect(s.modules.develop.map((l) => l.name)).toEqual(["RAW", "RAW 2"]);
  });
});

describe("the layouts file", () => {
  const state: LayoutsState = {
    modules: {
      library: [{ id: "m1", name: "Grid only", def: grid }],
      develop: [
        { id: "m2", name: "Minimal", def: minimal },
        { id: "m3", name: "RAW", def: raw },
      ],
    },
    parts: { "user.a": { library: "m1", develop: "m2" }, "user.b": { develop: "m3" } },
    order: ["user.b", "user.a"],
  };
  const saved: SavedLayout[] = [
    { id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } },
    { id: "user.b", name: "RAW editing", modules: { develop: raw } },
  ];

  it("round-trips into an empty install", () => {
    const file = exportFile(state, saved);
    const result = importFile(JSON.parse(JSON.stringify(file)), EMPTY_STATE, [], ids());
    expect(result.state.modules.develop.map((l) => l.name)).toEqual(["Minimal", "RAW"]);
    expect(result.creates.map((c) => c.name)).toEqual(["RAW editing", "Culling"]);
    expect(result.creates[1].modules).toEqual({ library: grid, develop: minimal });
  });

  it("adds beside what is there, renaming on a clash", () => {
    const file = exportFile(state, saved);
    const result = importFile(file, state, saved, ids());
    expect(result.state.modules.develop.map((l) => l.name)).toEqual(["Minimal", "RAW", "Minimal 2", "RAW 2"]);
    expect(result.creates.map((c) => c.name)).toEqual(["RAW editing 2", "Culling 2"]);
  });

  it("refuses a file that isn't a layouts file", () => {
    expect(() => importFile({ hello: 1 }, EMPTY_STATE, [], ids())).toThrow(/layouts file/);
  });

  it("skips malformed entries instead of failing the whole file", () => {
    const file = {
      format: "safelight-layouts",
      version: 1,
      moduleLayouts: { develop: [{ name: "Ok", def: raw }, { name: 3, def: raw }, { name: "No rails", def: {} }] },
      workspaces: [{ name: "W", parts: { develop: "Ok", library: "Missing" } }, { parts: {} }],
    };
    const result = importFile(file, EMPTY_STATE, [], ids());
    expect(result.state.modules.develop.map((l) => l.name)).toEqual(["Ok"]);
    expect(result.creates).toEqual([{ name: "W", modules: { develop: raw }, parts: { develop: "id1" } }]);
  });
});
