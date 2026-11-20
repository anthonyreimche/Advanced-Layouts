// The Layout menu section: workspaces in the person's order, then the current
// module's layouts with Update and Revert while the dock differs from the one
// it shows. The classes are the ones core's own menu items use, so they have
// CSS and the section reads as part of the menu.

import { React, api } from "./rt";
import type { Controller } from "./controller";
import { MANAGER_ID, MENU_ID } from "./ids";
import { useModuleLabels } from "./modules";

const ITEM =
  "flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] text-text-secondary hover:bg-surface-3 hover:text-text-primary";
const LABEL = "px-3 pb-0.5 pt-1.5 text-[9px] uppercase tracking-widest text-text-muted";
const RULE = "my-1 border-t border-border-subtle";

function Item(props: { checked?: boolean; title?: string; hint?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={props.checked} title={props.title} onClick={props.onClick} className={ITEM}>
      <span aria-hidden="true" className="w-3 text-slider-fill">
        {props.checked ? "✓" : ""}
      </span>
      <span className="truncate">{props.children}</span>
      {props.hint && (
        <span className="text-text-muted" style={{ marginLeft: "auto", paddingLeft: 8 }}>
          {props.hint}
        </span>
      )}
    </button>
  );
}

/** A name field in place of a menu item: Enter saves, Escape or leaving it
 *  cancels. */
function NameField(props: { placeholder: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = React.useState("");
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <input
        autoFocus
        value={draft}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) props.onSave(draft.trim());
          if (e.key === "Escape") {
            e.stopPropagation();
            props.onCancel();
          }
        }}
        onBlur={props.onCancel}
        className="min-w-0 flex-1 rounded bg-surface-1 px-1.5 py-0.5 text-[11px] text-text-primary outline-none placeholder:text-text-muted focus:bg-surface-3"
      />
    </div>
  );
}

export function LayoutMenuSection({ controller: c, close }: { controller: Controller; close: () => void }) {
  c.useRevision();
  api.layouts.saved.use();
  api.stores.useLayoutStore((s) => `${s.activeId}\n${s.editedFrom ?? ""}`);
  const module = api.stores.useUIStore((s) => s.activeModule);
  const labels = useModuleLabels();
  const [naming, setNaming] = React.useState<"workspace" | "module" | null>(null);

  const moduleIds = Object.keys(labels);
  const label = labels[module] ?? module;
  const active = c.activeWorkspace();
  const showing = c.showing(module);
  const modified = c.modified(module);
  const layouts = c.state().modules[module] ?? [];
  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <div>
      <div className={LABEL} id={`${MENU_ID}.workspaces`}>Workspaces</div>
      <div role="group" aria-labelledby={`${MENU_ID}.workspaces`}>
        {c.workspaces().map((w) => (
          <Item
            key={w.id}
            checked={active === w.id}
            hint={api.keybindings.getBinding(c.shortcutId(w.id)) || undefined}
            title={c.workspaceEdited(w.id) ? "Changed since it was picked" : undefined}
            onClick={run(() => c.applyWorkspace(w.id))}
          >
            {w.name}
            {c.workspaceEdited(w.id) ? " *" : ""}
          </Item>
        ))}
      </div>
      {naming === "workspace" ? (
        <NameField
          placeholder="Workspace name"
          onSave={(name) => {
            c.saveWorkspaceAs(name, moduleIds);
            close();
          }}
          onCancel={() => setNaming(null)}
        />
      ) : (
        <Item title="Save every module's arrangement as a new workspace" onClick={() => setNaming("workspace")}>
          Save workspace as…
        </Item>
      )}

      <div className={RULE} />
      <div className={LABEL} id={`${MENU_ID}.module`}>{label} layouts</div>
      <div role="group" aria-labelledby={`${MENU_ID}.module`}>
        {layouts.map((l) => (
          <Item key={l.id} checked={showing?.id === l.id} onClick={run(() => c.applyModuleLayout(module, l.id))}>
            {l.name}
            {showing?.id === l.id && modified ? " *" : ""}
          </Item>
        ))}
      </div>
      {showing && modified && (
        <>
          <Item
            title={`Save the ${label} panels as they are now into “${showing.name}”, and every workspace using it`}
            onClick={run(() => c.updateModuleLayout(module, showing.id))}
          >
            Update “{showing.name}”
          </Item>
          <Item title={`Put the ${label} panels back as “${showing.name}” has them`} onClick={run(() => c.revertModule(module))}>
            Revert to “{showing.name}”
          </Item>
        </>
      )}
      {naming === "module" ? (
        <NameField
          placeholder={`${label} layout name`}
          onSave={(name) => {
            c.saveModuleLayoutAs(module, name);
            close();
          }}
          onCancel={() => setNaming(null)}
        />
      ) : (
        <Item onClick={() => setNaming("module")}>Save current {label} layout as…</Item>
      )}

      <div className={RULE} />
      <Item
        title="Rename, reorder, export and import layouts and workspaces"
        onClick={run(() => api.windows.open(MANAGER_ID))}
      >
        Manage layouts…
      </Item>
    </div>
  );
}
