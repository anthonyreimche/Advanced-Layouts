// The pure model. A module layout is a named arrangement of one module's dock.
// A workspace is one of Safelight's saved layouts: Safelight applies it,
// lists it in the Layout menu and switches its extensions, and this extension
// remembers which module layout each of its modules came from ("parts"), so
// updating a module layout updates every workspace built from it.

import type { ModuleLayoutDef } from "./safelight";

export interface ModuleLayout {
  id: string;
  name: string;
  def: ModuleLayoutDef;
}

export interface LayoutsState {
  /** Module layouts by module id, in the order the person keeps them. */
  modules: Record<string, ModuleLayout[]>;
  /** By workspace id: the module layout each module's arrangement came from. */
  parts: Record<string, Record<string, string>>;
  /** Workspace ids, in the order the person keeps them. */
  order: string[];
}

export const EMPTY_STATE: LayoutsState = { modules: {}, parts: {}, order: [] };

/** One of Safelight's saved layouts, as far as this extension reads it. */
export interface SavedLayout {
  id: string;
  name: string;
  modules: Partial<Record<string, ModuleLayoutDef>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const round = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** What decides whether two arrangements look the same: sub-pixel sizes,
 *  the order of the collapsed list and empty records don't. */
function normalise(def: ModuleLayoutDef) {
  const floating = Object.entries(def.floating ?? {})
    .map(([id, f]) => [id, round(f.x), round(f.y), round(f.width)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return {
    rails: def.rails.map((r) => ({
      side: r.side,
      width: r.side === "bottom" ? null : round(r.width),
      height: r.side === "bottom" ? round(r.height) : null,
      panels: r.panels,
    })),
    floating,
    collapsed: [...(def.collapsed ?? [])].sort(),
  };
}

export function sameDef(a: ModuleLayoutDef, b: ModuleLayoutDef): boolean {
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

/** `name`, or "name 2", "name 3"… when it is taken. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  for (let i = 2; ; i++) if (!used.has(`${name} ${i}`)) return `${name} ${i}`;
}

export function addModuleLayout(
  state: LayoutsState,
  module: string,
  name: string,
  def: ModuleLayoutDef,
  id: string,
): { state: LayoutsState; id: string } {
  const list = state.modules[module] ?? [];
  const layout = { id, name: uniqueName(name, list.map((l) => l.name)), def };
  return { state: { ...state, modules: { ...state.modules, [module]: [...list, layout] } }, id };
}

/** Bring the parts in step with Safelight's saved layouts, which also change
 *  outside this extension (Preferences, another window). An arrangement with
 *  no part (a layout saved before this extension, or added in Preferences) is
 *  linked to a module layout that looks the same, or becomes one named after
 *  its workspace. Nothing is written to the saved layouts: one Safelight
 *  changed reads as drifted from its module layout until the person updates
 *  or reverts it. The module layouts it makes take ids from their workspace
 *  and module, so every window derives the same state and a second pass
 *  changes nothing. */
export function reconcile(
  state: LayoutsState,
  saved: readonly SavedLayout[],
  newId: (workspace: string, module: string) => string = (w, m) => `${w}:${m}`,
): { state: LayoutsState } {
  const byId = new Map(saved.map((s) => [s.id, s]));
  const order = [
    ...state.order.filter((id) => byId.has(id)),
    ...saved.map((s) => s.id).filter((id) => !state.order.includes(id)),
  ];
  const modules: Record<string, ModuleLayout[]> = { ...state.modules };
  const parts: Record<string, Record<string, string>> = {};

  for (const id of order) {
    const layout = byId.get(id)!;
    const own: Record<string, string> = {};
    for (const [m, def] of Object.entries(layout.modules)) {
      if (!def) continue;
      const list = modules[m] ?? [];
      const linked = list.find((l) => l.id === state.parts[id]?.[m]) ?? list.find((l) => sameDef(l.def, def));
      if (linked) {
        own[m] = linked.id;
        continue;
      }
      const created = { id: newId(id, m), name: uniqueName(layout.name, list.map((l) => l.name)), def };
      modules[m] = [...list, created];
      own[m] = created.id;
    }
    parts[id] = own;
  }
  return { state: { modules, parts, order } };
}

/** Whether a workspace's arrangement for `module` no longer matches the module
 *  layout it came from (Safelight wrote it: Preferences ↻, a collapsed panel). */
export function drifted(state: LayoutsState, layout: SavedLayout, module: string): boolean {
  const def = layout.modules[module];
  const part = state.modules[module]?.find((l) => l.id === state.parts[layout.id]?.[module]);
  return !!def && !!part && !sameDef(def, part.def);
}

/** The arrangements a workspace with these parts holds. */
export function partsToModules(
  state: LayoutsState,
  parts: Record<string, string>,
): Partial<Record<string, ModuleLayoutDef>> {
  const out: Partial<Record<string, ModuleLayoutDef>> = {};
  for (const [m, id] of Object.entries(parts)) {
    const def = state.modules[m]?.find((l) => l.id === id)?.def;
    if (def) out[m] = def;
  }
  return out;
}

// ── The layouts file ─────────────────────────────────────────────────────────

const FORMAT = "safelight-layouts";

export interface LayoutsFile {
  format: typeof FORMAT;
  version: 1;
  moduleLayouts: Record<string, { name: string; def: ModuleLayoutDef }[]>;
  workspaces: { name: string; parts: Record<string, string> }[];
}

/** Every module layout, and each workspace naming its module layouts. */
export function exportFile(state: LayoutsState, saved: readonly SavedLayout[]): LayoutsFile {
  const names = new Map(saved.map((s) => [s.id, s.name]));
  return {
    format: FORMAT,
    version: 1,
    moduleLayouts: Object.fromEntries(
      Object.entries(state.modules).map(([m, list]) => [m, list.map(({ name, def }) => ({ name, def }))]),
    ),
    workspaces: state.order
      .filter((id) => names.has(id))
      .map((id) => ({
        name: names.get(id)!,
        parts: Object.fromEntries(
          Object.entries(state.parts[id] ?? {}).flatMap(([m, partId]) => {
            const name = state.modules[m]?.find((l) => l.id === partId)?.name;
            return name ? [[m, name]] : [];
          }),
        ),
      })),
  };
}

const isSide = (v: unknown) => v === "left" || v === "right" || v === "bottom";

/** A def from a file, or null when it isn't one. Only the known fields are kept. */
function readDef(v: unknown): ModuleLayoutDef | null {
  if (!isRecord(v) || !Array.isArray(v.rails)) return null;
  const rails: ModuleLayoutDef["rails"] = [];
  for (const r of v.rails) {
    if (!isRecord(r) || !isSide(r.side) || !Array.isArray(r.panels)) return null;
    rails.push({
      side: r.side as "left" | "right" | "bottom",
      ...(typeof r.width === "number" ? { width: r.width } : {}),
      ...(typeof r.height === "number" ? { height: r.height } : {}),
      panels: r.panels.filter((p): p is string => typeof p === "string"),
    });
  }
  const def: ModuleLayoutDef = { rails };
  if (isRecord(v.floating)) {
    const floating: NonNullable<ModuleLayoutDef["floating"]> = {};
    for (const [id, f] of Object.entries(v.floating)) {
      if (isRecord(f) && [f.x, f.y, f.width].every((n) => typeof n === "number"))
        floating[id] = { x: f.x as number, y: f.y as number, width: f.width as number };
    }
    if (Object.keys(floating).length) def.floating = floating;
  }
  if (Array.isArray(v.collapsed)) {
    const collapsed = v.collapsed.filter((p): p is string => typeof p === "string");
    if (collapsed.length) def.collapsed = collapsed;
  }
  return def;
}

/** A workspace an import asks to be saved in Safelight. */
export interface WorkspaceCreate {
  name: string;
  modules: Partial<Record<string, ModuleLayoutDef>>;
  parts: Record<string, string>;
}

/** Add a file's module layouts and workspaces beside the ones there are,
 *  renaming any whose name is taken. Malformed entries are skipped. */
export function importFile(
  file: unknown,
  state: LayoutsState,
  saved: readonly SavedLayout[],
  newId: () => string,
): { state: LayoutsState; creates: WorkspaceCreate[] } {
  if (!isRecord(file) || file.format !== FORMAT || file.version !== 1)
    throw new Error("This isn't a Safelight layouts file.");
  let next = state;
  const byName = new Map<string, string>();
  const key = (m: string, name: string) => `${m}\n${name}`;
  for (const [m, list] of Object.entries(isRecord(file.moduleLayouts) ? file.moduleLayouts : {})) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const def = isRecord(entry) ? readDef(entry.def) : null;
      if (!def || typeof entry.name !== "string" || !entry.name.trim()) continue;
      const added = addModuleLayout(next, m, entry.name.trim(), def, newId());
      next = added.state;
      if (!byName.has(key(m, entry.name.trim()))) byName.set(key(m, entry.name.trim()), added.id);
    }
  }
  const creates: WorkspaceCreate[] = [];
  const taken = saved.map((s) => s.name);
  for (const w of Array.isArray(file.workspaces) ? file.workspaces : []) {
    if (!isRecord(w) || typeof w.name !== "string" || !w.name.trim()) continue;
    const parts: Record<string, string> = {};
    for (const [m, name] of Object.entries(isRecord(w.parts) ? w.parts : {})) {
      const id = typeof name === "string" ? byName.get(key(m, name)) : undefined;
      if (id) parts[m] = id;
    }
    const name = uniqueName(w.name.trim(), taken);
    taken.push(name);
    creates.push({ name, modules: partsToModules(next, parts), parts });
  }
  return { state: next, creates };
}
