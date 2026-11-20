// A stand-in Safelight API for unit tests, over real React and zustand. It has
// only what this extension uses: reading any other member throws, naming it.
//
// The dock is a def per module; `edit` changes the current module's the way a
// drag in the dock does (a saved or registered layout turns into Custom,
// edited from it). Saved layouts, the active layout and settings behave as
// Safelight's do, as far as this extension relies on them.

import * as React from "react";
import { create } from "zustand";
import type {
  KeyActionContribution,
  LayoutMenuContribution,
  ModuleLayoutDef,
  SafelightAPI,
  SavedLayout,
  WindowContribution,
} from "../../src/safelight";
import { sameDef } from "../../src/model";

import { EXTENSION_ID } from "../../src/ids";

type FakeMembers = Pick<
  SafelightAPI,
  | "version"
  | "extensionId"
  | "react"
  | "registerKeybinding"
  | "unregisterKeybinding"
  | "registerLayoutMenu"
  | "registerWindow"
> & {
  layouts: SafelightAPI["layouts"];
  settings: SafelightAPI["settings"];
  stores: Pick<SafelightAPI["stores"], "useLayoutStore" | "useUIStore" | "create">;
  registry: SafelightAPI["registry"];
  keybindings: Pick<SafelightAPI["keybindings"], "getBinding">;
  preferences: Pick<SafelightAPI["preferences"], "open">;
  windows: Pick<SafelightAPI["windows"], "open" | "close">;
  components: Pick<SafelightAPI["components"], "ShortcutField" | "LayoutExtensionsEditor">;
  ui: Pick<SafelightAPI["ui"], "confirmDialog" | "alertDialog" | "Button" | "Select" | "TextInput" | "Section" | "Stack" | "Row" | "Card" | "tokens">;
};

export interface Rig {
  api: SafelightAPI;
  /** The current module's dock, and the others as they'd load. */
  docks: Record<string, ModuleLayoutDef>;
  saved(): Record<string, SavedLayout>;
  /** An edit in the dock of the current module. */
  edit(def: ModuleLayoutDef): void;
  setModule(module: string): void;
  keybindings: Map<string, KeyActionContribution>;
  menus: LayoutMenuContribution[];
  windows: WindowContribution[];
  opened: string[];
  confirms: string[];
  /** What the next confirmDialog answers. */
  answer: { confirm: boolean };
}

const CUSTOM = "custom";

export function fakeApi(opts: { modules?: string[]; docks?: Record<string, ModuleLayoutDef>; saved?: SavedLayout[] } = {}): Rig {
  const moduleIds = opts.modules ?? ["library", "develop"];
  const docks: Record<string, ModuleLayoutDef> = { ...opts.docks };
  const savedStore = create<{ layouts: Record<string, SavedLayout> }>()(() => ({
    layouts: Object.fromEntries((opts.saved ?? []).map((s) => [s.id, s])),
  }));
  const layoutStore = create<{ activeId: string; editedFrom?: string }>()(() => ({ activeId: CUSTOM }));
  const uiStore = create<{ activeModule: string }>()(() => ({ activeModule: moduleIds[1] ?? moduleIds[0] }));
  const registryStore = create<{ modules: Record<string, { id: string; label: string; order?: number }> }>()(() => ({
    modules: Object.fromEntries(
      moduleIds.map((id, i) => [id, { id, label: id[0].toUpperCase() + id.slice(1), order: i }]),
    ),
  }));
  const settingsData = new Map<string, unknown>();
  const settingsListeners = new Set<(key: string, value: unknown) => void>();
  const keybindings = new Map<string, KeyActionContribution>();
  const menus: LayoutMenuContribution[] = [];
  const windows: WindowContribution[] = [];
  const opened: string[] = [];
  const confirms: string[] = [];
  let nextId = 0;
  const answer = { confirm: true };

  const current = () => uiStore.getState().activeModule;
  const putSaved = (layout: SavedLayout) =>
    savedStore.setState((s) => ({ layouts: { ...s.layouts, [layout.id]: layout } }));

  const toCustom = () => {
    const { activeId } = layoutStore.getState();
    if (activeId !== CUSTOM) layoutStore.setState({ activeId: CUSTOM, editedFrom: activeId });
  };

  const members: FakeMembers = {
    version: 1,
    extensionId: EXTENSION_ID,
    react: React,
    registerKeybinding: (c) => void keybindings.set(c.id, c),
    unregisterKeybinding: (id) => void keybindings.delete(id),
    registerLayoutMenu: (c) => void menus.push(c),
    registerWindow: (c) => void windows.push(c),
    layouts: {
      apply: (id) => {
        layoutStore.setState({ activeId: id, editedFrom: undefined });
        const layout = savedStore.getState().layouts[id];
        if (layout) for (const [m, def] of Object.entries(layout.modules)) if (def) docks[m] = def;
      },
      capture: (module) => {
        const m = module ?? current();
        return moduleIds.includes(m) ? (docks[m] ?? { rails: [] }) : null;
      },
      shows: (def) => sameDef(docks[current()] ?? { rails: [] }, def),
      show: (def) => {
        docks[current()] = def;
        const active = savedStore.getState().layouts[layoutStore.getState().activeId];
        if (active) putSaved({ ...active, modules: { ...active.modules, [current()]: def } });
        else toCustom();
      },
      saved: {
        list: () => Object.values(savedStore.getState().layouts),
        use: () => Object.values(savedStore((s) => s.layouts)),
        save: (input) => {
          const existing = input.id === undefined ? undefined : savedStore.getState().layouts[input.id];
          if (input.id !== undefined && !existing) throw new Error(`There is no saved layout "${input.id}"`);
          const id = existing?.id ?? `user.${++nextId}`;
          putSaved({ ...existing, id, name: input.name.trim() || existing?.name || "Layout", modules: { ...input.modules } });
          if (existing && layoutStore.getState().activeId === id) {
            const def = input.modules[current()];
            if (def) docks[current()] = def;
          }
          return id;
        },
        remove: (id) => {
          savedStore.setState((s) => {
            const next = { ...s.layouts };
            delete next[id];
            return { layouts: next };
          });
          if (layoutStore.getState().activeId === id) layoutStore.setState({ activeId: CUSTOM, editedFrom: undefined });
        },
        onChange: (listener) => savedStore.subscribe(listener),
      },
    },
    settings: {
      get: <T,>(key: string, fallback: T) => (settingsData.has(key) ? (settingsData.get(key) as T) : fallback),
      set: (key, value) => {
        settingsData.set(key, JSON.parse(JSON.stringify(value)));
        for (const l of settingsListeners) l(key, value);
      },
      onChange: (cb) => {
        settingsListeners.add(cb);
        return () => void settingsListeners.delete(cb);
      },
    },
    stores: {
      useLayoutStore: layoutStore as unknown as SafelightAPI["stores"]["useLayoutStore"],
      useUIStore: uiStore as unknown as SafelightAPI["stores"]["useUIStore"],
      create,
    },
    registry: {
      use: (selector) => registryStore(selector as never),
    },
    components: {
      ShortcutField: ({ actionId }) => React.createElement("span", { "data-testid": "shortcut-field", "data-action": actionId }),
      LayoutExtensionsEditor: ({ layoutId }) =>
        React.createElement("div", { "data-testid": "layout-extensions", "data-layout": layoutId }),
    },
    keybindings: { getBinding: (id) => (id.endsWith("bound") ? "Ctrl+1" : "") },
    preferences: { open: (id) => void opened.push(`prefs:${id ?? ""}`) },
    windows: {
      open: (id) => void opened.push(`window:${id}`),
      close: (id) => void opened.push(`close:${id}`),
    },
    ui: {
      confirmDialog: async (o) => {
        confirms.push(o.message);
        return answer.confirm;
      },
      alertDialog: async (o) => void confirms.push(o.message),
      ...uiKit,
    },
  };

  return {
    api: strict(members, "api") as unknown as SafelightAPI,
    docks,
    saved: () => savedStore.getState().layouts,
    edit: (def) => {
      docks[current()] = def;
      toCustom();
    },
    setModule: (module) => uiStore.setState({ activeModule: module }),
    keybindings,
    menus,
    windows,
    opened,
    confirms,
    answer,
  };
}

// Core's UI kit as plain elements, enough to find and drive in a test.
type Kit = Pick<SafelightAPI["ui"], "Button" | "Select" | "TextInput" | "Section" | "Stack" | "Row" | "Card" | "tokens">;
const uiKit: Kit = {
  Button: ({ variant: _v, size: _s, active: _a, full: _f, ...rest }) => React.createElement("button", { type: "button", ...rest }),
  Select: (p) =>
    React.createElement(
      "select",
      { "aria-label": p.ariaLabel, value: p.value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => p.onChange(e.target.value) },
      (p.options ?? []).map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label)),
    ),
  TextInput: ({ value, onChange, ...rest }) =>
    React.createElement("input", { ...rest, value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }),
  Section: (p) => React.createElement("section", null, React.createElement("h3", null, p.title), p.children),
  Stack: (p) => React.createElement("div", null, p.children),
  Row: (p) => React.createElement("div", null, p.children),
  Card: (p) => React.createElement("div", null, p.children),
  tokens: { textPrimary: "var(--color-text-primary)", textSecondary: "var(--color-text-secondary)", textMuted: "var(--color-text-muted)", accent: "var(--color-accent)" } as Kit["tokens"],
};

/** Wraps a plain object so reading a member it lacks throws, naming the member. */
function strict<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return Reflect.get(obj, key, receiver);
      if (!(key in obj)) throw new Error(`The fake API has no ${path}.${key}. Add it to test/support/fake-api.ts.`);
      const value: unknown = Reflect.get(obj, key, receiver);
      const isPlainObject = typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
      return isPlainObject && key !== "react" ? strict(value, `${path}.${key}`) : value;
    },
  });
}
