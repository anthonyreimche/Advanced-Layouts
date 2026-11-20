// The Layout menu section and the Layouts window, driven as the person would.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModuleLayoutDef, SavedLayout } from "../src/safelight";
import { createController } from "../src/controller";
import { LayoutMenuSection } from "../src/LayoutMenu";
import { Manager } from "../src/Manager";
import { initRuntime } from "../src/rt";
import { fakeApi } from "./support/fake-api";

const grid: ModuleLayoutDef = { rails: [{ side: "left", width: 260, panels: ["core.folders"] }] };
const minimal: ModuleLayoutDef = { rails: [{ side: "right", width: 300, panels: ["core.basic"] }] };
const raw: ModuleLayoutDef = { rails: [{ side: "right", width: 320, panels: ["core.basic", "core.detail"] }] };

const SAVED: SavedLayout[] = [
  { id: "user.b", name: "RAW editing", modules: { library: grid, develop: raw } },
  { id: "user.a", name: "Culling", modules: { library: grid, develop: minimal } },
];

function setup(saved = SAVED) {
  const rig = fakeApi({ docks: { library: grid, develop: minimal }, saved });
  initRuntime(rig.api);
  const c = createController(rig.api);
  return { rig, c };
}

afterEach(cleanup);

function menu(c: ReturnType<typeof setup>["c"]) {
  const close = vi.fn();
  render(<LayoutMenuSection controller={c} close={close} />);
  return close;
}

const item = (name: RegExp | string) => screen.getByRole("button", { name });
const group = (name: string) => within(screen.getByRole("group", { name }));

describe("the Layout menu section", () => {
  it("lists the workspaces in the person's order and picks one", () => {
    const { rig, c } = setup();
    c.moveWorkspace("user.a", -1);
    const close = menu(c);
    const names = group("Workspaces").getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Culling", "RAW editing"]);
    fireEvent.click(group("Workspaces").getByRole("button", { name: "RAW editing" }));
    expect(rig.api.stores.useLayoutStore.getState().activeId).toBe("user.b");
    expect(rig.docks.develop).toEqual(raw);
    expect(close).toHaveBeenCalled();
  });

  it("marks the workspace and its module layout changed after a dock edit, with Update and Revert", () => {
    const { rig, c } = setup();
    c.applyWorkspace("user.a");
    rig.edit(raw);
    menu(c);
    expect(group("Workspaces").getByRole("button", { name: "Culling *" }).getAttribute("aria-pressed")).toBe("true");
    expect(group("Develop layouts").getByRole("button", { name: "Culling *" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(item("Update “Culling”"));
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
  });

  it("offers no Update or Revert while the dock shows the layout", () => {
    const { c } = setup();
    c.applyWorkspace("user.a");
    menu(c);
    expect(screen.queryByText(/Update “/)).toBeNull();
    expect(screen.queryByText(/Revert to “/)).toBeNull();
  });

  it("lists the current module's layouts under its name and applies one", () => {
    const { rig, c } = setup();
    c.applyWorkspace("user.a");
    menu(c);
    fireEvent.click(group("Develop layouts").getByRole("button", { name: "RAW editing" }));
    expect(rig.docks.develop).toEqual(raw);
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
  });

  it("saves the current module's layout under a typed name", () => {
    const { rig, c } = setup();
    rig.edit(raw);
    const close = menu(c);
    fireEvent.click(item("Save current Develop layout as…"));
    const field = screen.getByLabelText("Develop layout name");
    fireEvent.change(field, { target: { value: "Detail work" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(c.state().modules.develop.map((l) => l.name)).toContain("Detail work");
    expect(c.showing("develop")?.name).toBe("Detail work");
    expect(close).toHaveBeenCalled();
  });

  it("saves every module as a new workspace", () => {
    const { rig, c } = setup();
    menu(c);
    fireEvent.click(item("Save workspace as…"));
    const field = screen.getByLabelText("Workspace name");
    fireEvent.change(field, { target: { value: "Print" } });
    fireEvent.keyDown(field, { key: "Enter" });
    const print = Object.values(rig.saved()).find((s) => s.name === "Print");
    expect(print?.modules).toEqual({ library: grid, develop: minimal });
  });

  it("opens the Layouts window", () => {
    const { rig, c } = setup();
    menu(c);
    fireEvent.click(item("Manage layouts…"));
    expect(rig.opened).toEqual(["window:advanced-layouts.manager"]);
  });
});

describe("the Layouts window", () => {
  it("renames a workspace", () => {
    const { rig, c } = setup();
    render(<Manager controller={c} />);
    fireEvent.click(item("Rename workspace Culling"));
    const field = screen.getByLabelText("New name for workspace Culling");
    fireEvent.change(field, { target: { value: "Cull" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rig.saved()["user.a"].name).toBe("Cull");
  });

  it("picks a workspace's layout for a module", () => {
    const { rig, c } = setup();
    render(<Manager controller={c} />);
    const rawId = c.state().parts["user.b"].develop;
    fireEvent.change(screen.getByLabelText("Develop layout of Culling"), { target: { value: rawId } });
    expect(rig.saved()["user.a"].modules.develop).toEqual(raw);
  });

  it("deletes a workspace once confirmed, and keeps it when not", async () => {
    const { rig, c } = setup();
    render(<Manager controller={c} />);
    rig.answer.confirm = false;
    fireEvent.click(item("Delete workspace Culling"));
    await Promise.resolve();
    expect(rig.saved()["user.a"]).toBeTruthy();
    rig.answer.confirm = true;
    fireEvent.click(item("Delete workspace Culling"));
    await vi.waitFor(() => expect(rig.saved()["user.a"]).toBeUndefined());
  });

  it("sets each workspace's shortcut in the window, with Safelight's shortcut field", () => {
    const { rig, c } = setup();
    render(<Manager controller={c} />);
    const fields = screen.getAllByTestId("shortcut-field").map((el) => el.getAttribute("data-action"));
    expect(fields).toEqual([c.shortcutId("user.b"), c.shortcutId("user.a")]);
    expect(rig.opened).toEqual([]);
  });

  it("shows which extensions a workspace switches in the window, without opening Preferences", () => {
    const { rig, c } = setup();
    render(<Manager controller={c} />);
    expect(screen.queryByTestId("layout-extensions")).toBeNull();
    const toggle = item("Extensions for Culling");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByTestId("layout-extensions").getAttribute("data-layout")).toBe("user.a");
    expect(item("Extensions for Culling").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(item("Extensions for Culling"));
    expect(screen.queryByTestId("layout-extensions")).toBeNull();
    expect(rig.opened).toEqual([]);
  });

  it("reorders workspaces and module layouts", () => {
    const { c } = setup();
    render(<Manager controller={c} />);
    fireEvent.click(item("Move workspace RAW editing down"));
    expect(c.workspaces().map((w) => w.name)).toEqual(["Culling", "RAW editing"]);
    fireEvent.click(item("Move Develop layout RAW editing down"));
    expect(c.state().modules.develop.map((l) => l.name)).toEqual(["Culling", "RAW editing"]);
  });
});

void React;
