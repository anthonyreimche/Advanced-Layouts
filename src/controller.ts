// Module layouts and workspaces over Safelight's layouts API. The state kept
// in this extension's settings is only ever read through reconcile(), so a
// saved layout changed elsewhere (Preferences, another window) is picked up
// on the next read without anything being written back.

import type { ModuleLayoutDef, SafelightAPI, SavedLayout } from "./safelight";
import {
  EMPTY_STATE,
  addModuleLayout,
  drifted,
  exportFile,
  importFile,
  reconcile,
  sameDef,
  uniqueName,
  type LayoutsState,
  type ModuleLayout,
} from "./model";

const STATE_KEY = "layouts";
const CUSTOM = "custom";

/** The module layout a module was last shown from by this extension in this
 *  window, valid while the layout choice is still the one it was shown under. */
interface Basis {
  id: string;
  activeId: string;
  editedFrom: string | undefined;
}

export type Controller = ReturnType<typeof createController>;

export function createController(api: SafelightAPI) {
  const revision = api.stores.create<{ n: number }>()(() => ({ n: 0 }));
  const bump = () => revision.setState((s) => ({ n: s.n + 1 }));
  const basis = new Map<string, Basis>();
  const shortcuts = new Set<string>();
  let counter = 0;
  const newId = () => `${Date.now().toString(36)}-${(++counter).toString(36)}`;

  const savedList = (): SavedLayout[] => api.layouts.saved.list();
  const stored = (): LayoutsState => api.settings.get<LayoutsState>(STATE_KEY, EMPTY_STATE);
  const state = (): LayoutsState => reconcile(stored(), savedList()).state;
  const persist = (next: LayoutsState) => {
    api.settings.set(STATE_KEY, next);
    bump();
  };
  const layoutChoice = () => api.stores.useLayoutStore.getState();
  const currentModule = (): string => api.stores.useUIStore.getState().activeModule;
  const savedById = (id: string) => savedList().find((s) => s.id === id);
  const findLayout = (s: LayoutsState, module: string, id: string) => s.modules[module]?.find((l) => l.id === id);

  function setBasis(module: string, id: string) {
    const { activeId, editedFrom } = layoutChoice();
    basis.set(module, { id, activeId, editedFrom });
  }

  /** The workspace showing: the saved layout picked, or the one an edit in
   *  the dock turned into Custom. */
  function activeWorkspace(): string | null {
    const { activeId, editedFrom } = layoutChoice();
    if (savedById(activeId)) return activeId;
    if (activeId === CUSTOM && editedFrom && savedById(editedFrom)) return editedFrom;
    return null;
  }

  /** The module layout `module` shows, if it shows one. */
  function showing(module: string): ModuleLayout | null {
    const s = state();
    const b = basis.get(module);
    const { activeId, editedFrom } = layoutChoice();
    if (b && b.activeId === activeId && b.editedFrom === editedFrom) {
      const layout = findLayout(s, module, b.id);
      if (layout) return layout;
    }
    const w = activeWorkspace();
    const partId = w ? s.parts[w]?.[module] : undefined;
    return (partId && findLayout(s, module, partId)) || null;
  }

  /** Whether `module`'s dock differs from the module layout it shows. */
  function modified(module: string): boolean {
    const layout = showing(module);
    if (!layout) return false;
    if (module === currentModule()) return !api.layouts.shows(layout.def);
    const live = api.layouts.capture(module);
    return !!live && !sameDef(live, layout.def);
  }

  function workspaceEdited(id: string): boolean {
    if (activeWorkspace() !== id) return false;
    if (layoutChoice().editedFrom === id) return true;
    const layout = savedById(id);
    const s = state();
    return !!layout && Object.keys(layout.modules).some((m) => drifted(s, layout, m));
  }

  /** Workspaces in the person's order. */
  function workspaces(): SavedLayout[] {
    const byId = new Map(savedList().map((l) => [l.id, l]));
    return state().order.flatMap((id) => byId.get(id) ?? []);
  }

  /** The arrangement of each module as it shows now, each linked to the module
   *  layout it shows (or one that looks the same), else made into a new one
   *  named `name`. */
  function captureParts(s: LayoutsState, modules: readonly string[], name: string) {
    let next = s;
    const defs: Record<string, ModuleLayoutDef> = {};
    const parts: Record<string, string> = {};
    for (const m of modules) {
      const def = api.layouts.capture(m);
      if (!def) continue;
      defs[m] = def;
      const shown = showing(m);
      const match =
        (shown && sameDef(shown.def, def) ? shown : null) ?? next.modules[m]?.find((l) => sameDef(l.def, def));
      if (match) {
        parts[m] = match.id;
      } else {
        const added = addModuleLayout(next, m, name, def, newId());
        next = added.state;
        parts[m] = added.id;
      }
    }
    return { state: next, defs, parts };
  }

  /** Pick the workspace an edit turned into Custom again once the dock shows
   *  it once more, so it no longer reads as Custom. */
  function repickIfShown() {
    const { activeId, editedFrom } = layoutChoice();
    if (activeId !== CUSTOM || !editedFrom) return;
    const layout = savedById(editedFrom);
    if (!layout) return;
    const shown = Object.entries(layout.modules).every(([m, def]) => {
      const live = api.layouts.capture(m);
      return !def || !live || sameDef(live, def);
    });
    if (shown) api.layouts.apply(editedFrom);
  }

  // ── Workspaces ──────────────────────────────────────────────────────────────

  function applyWorkspace(id: string) {
    basis.clear();
    api.layouts.apply(id);
    bump();
  }

  function saveWorkspaceAs(name: string, modules: readonly string[]): string {
    const wanted = uniqueName(name.trim() || "Workspace", savedList().map((l) => l.name));
    const captured = captureParts(state(), modules, wanted);
    const id = api.layouts.saved.save({ name: wanted, modules: captured.defs });
    persist({
      ...captured.state,
      parts: { ...captured.state.parts, [id]: captured.parts },
      order: [...captured.state.order.filter((o) => o !== id), id],
    });
    applyWorkspace(id);
    syncShortcuts();
    return id;
  }

  function updateWorkspace(id: string, modules: readonly string[]) {
    const layout = savedById(id);
    if (!layout) return;
    const captured = captureParts(state(), modules, layout.name);
    api.layouts.saved.save({ id, name: layout.name, modules: { ...layout.modules, ...captured.defs } });
    persist({
      ...captured.state,
      parts: { ...captured.state.parts, [id]: { ...captured.state.parts[id], ...captured.parts } },
    });
    if (layoutChoice().editedFrom === id) applyWorkspace(id);
  }

  function setPart(id: string, module: string, layoutId: string | null) {
    const layout = savedById(id);
    const s = state();
    if (!layout) return;
    const modules = { ...layout.modules };
    const parts = { ...s.parts[id] };
    const chosen = layoutId === null ? undefined : findLayout(s, module, layoutId);
    if (chosen) {
      modules[module] = chosen.def;
      parts[module] = chosen.id;
    } else {
      delete modules[module];
      delete parts[module];
    }
    api.layouts.saved.save({ id, name: layout.name, modules });
    persist({ ...s, parts: { ...s.parts, [id]: parts } });
  }

  function renameWorkspace(id: string, name: string) {
    const layout = savedById(id);
    if (!layout || !name.trim()) return;
    const others = savedList().filter((l) => l.id !== id).map((l) => l.name);
    api.layouts.saved.save({ id, name: uniqueName(name.trim(), others), modules: layout.modules });
    syncShortcuts();
    bump();
  }

  /** A copy beside the original. Its extension ticks aren't copied: those are
   *  set in Preferences. */
  function duplicateWorkspace(id: string): string {
    const layout = savedById(id);
    if (!layout) return id;
    const s = state();
    const copy = api.layouts.saved.save({
      name: uniqueName(layout.name, savedList().map((l) => l.name)),
      modules: layout.modules,
    });
    const order = s.order.filter((o) => o !== copy);
    order.splice(order.indexOf(id) + 1, 0, copy);
    persist({ ...s, parts: { ...s.parts, [copy]: { ...s.parts[id] } }, order });
    syncShortcuts();
    return copy;
  }

  function deleteWorkspace(id: string) {
    const s = state();
    api.layouts.saved.remove(id);
    const parts = { ...s.parts };
    delete parts[id];
    persist({ ...s, parts, order: s.order.filter((o) => o !== id) });
    syncShortcuts();
  }

  function moveWorkspace(id: string, delta: number) {
    const s = state();
    persist({ ...s, order: moved(s.order, id, delta) });
  }

  // ── Module layouts ──────────────────────────────────────────────────────────

  function saveModuleLayoutAs(module: string, name: string): string {
    const def = api.layouts.capture(module);
    if (!def) throw new Error(`There is no "${module}" module.`);
    const added = addModuleLayout(state(), module, name.trim() || "Layout", def, newId());
    persist(added.state);
    setBasis(module, added.id);
    bump();
    return added.id;
  }

  /** Show a module layout in the current module. Under a workspace it becomes
   *  the workspace's pick for the module. */
  function applyModuleLayout(module: string, id: string) {
    const s = state();
    const layout = findLayout(s, module, id);
    if (!layout || module !== currentModule()) return;
    api.layouts.show(layout.def);
    const { activeId } = layoutChoice();
    if (savedById(activeId)) persist({ ...s, parts: { ...s.parts, [activeId]: { ...s.parts[activeId], [module]: id } } });
    setBasis(module, id);
    bump();
  }

  /** Write the module's dock into the module layout, and into every workspace
   *  built from it. */
  function updateModuleLayout(module: string, id: string) {
    const def = api.layouts.capture(module);
    const s = state();
    if (!def || !findLayout(s, module, id)) return;
    const next: LayoutsState = {
      ...s,
      modules: { ...s.modules, [module]: s.modules[module].map((l) => (l.id === id ? { ...l, def } : l)) },
    };
    for (const w of workspaces()) {
      if (next.parts[w.id]?.[module] === id)
        api.layouts.saved.save({ id: w.id, name: w.name, modules: { ...w.modules, [module]: def } });
    }
    persist(next);
    const kept = basis.get(module);
    repickIfShown();
    if (kept?.id === id) setBasis(module, id);
    bump();
  }

  /** Show the module layout `module` shows again, dropping the dock's edits. */
  function revertModule(module: string) {
    const layout = showing(module);
    if (!layout || module !== currentModule()) return;
    const kept = basis.get(module);
    const w = activeWorkspace();
    const { activeId, editedFrom } = layoutChoice();
    if (w && activeId === CUSTOM && editedFrom === w) api.layouts.apply(w);
    if (!api.layouts.shows(layout.def)) api.layouts.show(layout.def);
    if (kept?.id === layout.id) setBasis(module, layout.id);
    bump();
  }

  function renameModuleLayout(module: string, id: string, name: string) {
    const s = state();
    if (!name.trim() || !findLayout(s, module, id)) return;
    const others = s.modules[module].filter((l) => l.id !== id).map((l) => l.name);
    const unique = uniqueName(name.trim(), others);
    persist({
      ...s,
      modules: { ...s.modules, [module]: s.modules[module].map((l) => (l.id === id ? { ...l, name: unique } : l)) },
    });
  }

  function duplicateModuleLayout(module: string, id: string): string {
    const s = state();
    const layout = findLayout(s, module, id);
    if (!layout) return id;
    const added = addModuleLayout(s, module, layout.name, layout.def, newId());
    const list = added.state.modules[module].filter((l) => l.id !== added.id);
    list.splice(list.findIndex((l) => l.id === id) + 1, 0, added.state.modules[module].at(-1)!);
    persist({ ...added.state, modules: { ...added.state.modules, [module]: list } });
    return added.id;
  }

  /** Workspaces built from it keep their arrangement. */
  function deleteModuleLayout(module: string, id: string) {
    const s = state();
    const parts = Object.fromEntries(
      Object.entries(s.parts).map(([w, own]) => {
        const rest = { ...own };
        if (rest[module] === id) delete rest[module];
        return [w, rest];
      }),
    );
    persist({ ...s, modules: { ...s.modules, [module]: s.modules[module].filter((l) => l.id !== id) }, parts });
    if (basis.get(module)?.id === id) basis.delete(module);
  }

  function moveModuleLayout(module: string, id: string, delta: number) {
    const s = state();
    const list = s.modules[module] ?? [];
    const ids = moved(list.map((l) => l.id), id, delta);
    persist({ ...s, modules: { ...s.modules, [module]: ids.map((i) => list.find((l) => l.id === i)!) } });
  }

  /** The workspaces whose pick for `module` is this module layout. */
  function usedBy(module: string, id: string): SavedLayout[] {
    const s = state();
    return workspaces().filter((w) => s.parts[w.id]?.[module] === id);
  }

  // ── Shortcuts ───────────────────────────────────────────────────────────────

  const shortcutId = (workspace: string) => `${api.extensionId}.workspace.${workspace}`;

  /** One shortcut per workspace, unbound until the person binds it in the
   *  Layouts window (or Preferences ▸ Shortcuts). */
  function syncShortcuts() {
    const live = new Set<string>();
    for (const w of workspaces()) {
      const id = shortcutId(w.id);
      live.add(id);
      api.registerKeybinding({
        id,
        label: `Switch to workspace: ${w.name}`,
        category: "General",
        defaultCombo: "",
        handler: () => applyWorkspace(w.id),
      });
      shortcuts.add(id);
    }
    for (const id of shortcuts) {
      if (live.has(id)) continue;
      api.unregisterKeybinding(id);
      shortcuts.delete(id);
    }
  }

  // ── The layouts file ────────────────────────────────────────────────────────

  function exportText(): string {
    return JSON.stringify(exportFile(state(), workspaces()), null, 2);
  }

  /** Add a layouts file's module layouts and workspaces. */
  function importText(text: string): { workspaces: number; moduleLayouts: number } {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("This isn't a Safelight layouts file.");
    }
    const s = state();
    const result = importFile(json, s, savedList(), newId);
    let next = result.state;
    for (const create of result.creates) {
      const id = api.layouts.saved.save({ name: create.name, modules: create.modules });
      next = { ...next, parts: { ...next.parts, [id]: create.parts }, order: [...next.order, id] };
    }
    persist(next);
    syncShortcuts();
    const count = (x: LayoutsState) => Object.values(x.modules).reduce((n, list) => n + list.length, 0);
    return { workspaces: result.creates.length, moduleLayouts: count(next) - count(s) };
  }

  // Settle the stored state once, so the parts made for saved layouts from
  // before (and their ids) are kept; every window derives the same.
  const settled = state();
  if (JSON.stringify(settled) !== JSON.stringify(stored())) api.settings.set(STATE_KEY, settled);
  api.settings.onChange((key) => {
    if (key === STATE_KEY) bump();
  });
  api.layouts.saved.onChange(() => {
    syncShortcuts();
    bump();
  });

  return {
    /** React hook: re-renders when the state or the saved layouts change. */
    useRevision: () => revision((s) => s.n),
    state,
    workspaces,
    activeWorkspace,
    workspaceEdited,
    showing,
    modified,
    currentModule,
    usedBy,
    applyWorkspace,
    saveWorkspaceAs,
    updateWorkspace,
    setPart,
    renameWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    moveWorkspace,
    saveModuleLayoutAs,
    applyModuleLayout,
    updateModuleLayout,
    revertModule,
    renameModuleLayout,
    duplicateModuleLayout,
    deleteModuleLayout,
    moveModuleLayout,
    shortcutId,
    syncShortcuts,
    exportText,
    importText,
  };
}

function moved(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const to = Math.max(0, Math.min(ids.length - 1, from + delta));
  const next = ids.filter((i) => i !== id);
  next.splice(to, 0, id);
  return next;
}
