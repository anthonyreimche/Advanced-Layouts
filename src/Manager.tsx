// The Layouts window: workspaces and module layouts in one place, with
// rename, duplicate, update, delete, reorder, each workspace's pick per
// module and its shortcut, and export and import as a file.

import { React, api } from "./rt";
import type { Controller } from "./controller";
import { drifted, type ModuleLayout } from "./model";
import { useModuleLabels } from "./modules";
import type { SavedLayout } from "./safelight";

const muted: React.CSSProperties = { color: "var(--color-text-muted)", fontSize: 11 };

/** A name that turns into a field to rename it. */
function Name(props: { name: string; suffix?: string; label: string; onRename: (name: string) => void }) {
  const { TextInput } = api.ui;
  const [draft, setDraft] = React.useState<string | null>(null);
  if (draft === null)
    return (
      <button
        type="button"
        title="Rename"
        aria-label={`Rename ${props.label}`}
        onClick={() => setDraft(props.name)}
        style={{ all: "unset", cursor: "text", fontSize: 12, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: api.ui.tokens.textPrimary }}
      >
        {props.name}
        {props.suffix}
      </button>
    );
  const commit = () => {
    if (draft.trim() && draft.trim() !== props.name) props.onRename(draft.trim());
    setDraft(null);
  };
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <TextInput
        autoFocus
        value={draft}
        aria-label={`New name for ${props.label}`}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

function Move(props: { label: string; onMove: (delta: number) => void; first: boolean; last: boolean }) {
  const { Button } = api.ui;
  return (
    <>
      <Button size="sm" variant="ghost" title="Move up" aria-label={`Move ${props.label} up`} disabled={props.first} onClick={() => props.onMove(-1)}>
        ↑
      </Button>
      <Button size="sm" variant="ghost" title="Move down" aria-label={`Move ${props.label} down`} disabled={props.last} onClick={() => props.onMove(1)}>
        ↓
      </Button>
    </>
  );
}

async function confirmDelete(what: string, extra = ""): Promise<boolean> {
  return api.ui.confirmDialog({
    title: `Delete ${what}?`,
    message: `${what} will be deleted.${extra}`,
    confirmLabel: "Delete",
    variant: "danger",
  });
}

function WorkspaceRow(props: {
  c: Controller;
  w: SavedLayout;
  index: number;
  count: number;
  labels: Record<string, string>;
}) {
  const { c, w, labels } = props;
  const { Button, Select, Row, Stack, Card } = api.ui;
  const { ShortcutField, LayoutExtensionsEditor } = api.components;
  const state = c.state();
  const active = c.activeWorkspace() === w.id;
  const [showExtensions, setShowExtensions] = React.useState(false);
  return (
    <Card>
      <Stack gap={6}>
        <Row gap={4} align="center">
          <span aria-hidden="true" style={{ width: 12, color: api.ui.tokens.accent }}>
            {active ? "✓" : ""}
          </span>
          <Name
            name={w.name}
            suffix={c.workspaceEdited(w.id) ? " *" : ""}
            label={`workspace ${w.name}`}
            onRename={(name) => c.renameWorkspace(w.id, name)}
          />
          <Move label={`workspace ${w.name}`} first={props.index === 0} last={props.index === props.count - 1} onMove={(d) => c.moveWorkspace(w.id, d)} />
          <Button size="sm" variant="ghost" onClick={() => c.applyWorkspace(w.id)} title="Switch to this workspace">
            Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Save every module's arrangement as it is now into this workspace"
            onClick={() => c.updateWorkspace(w.id, Object.keys(labels))}
          >
            Update
          </Button>
          <Button size="sm" variant="ghost" title="Make a copy of this workspace" onClick={() => c.duplicateWorkspace(w.id)}>
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Delete this workspace"
            aria-label={`Delete workspace ${w.name}`}
            onClick={async () => {
              if (await confirmDelete(`“${w.name}”`, " Its module layouts are kept.")) c.deleteWorkspace(w.id);
            }}
          >
            ×
          </Button>
        </Row>
        {Object.entries(labels).map(([m, label]) => {
          const options = [
            { value: "", label: "Default" },
            ...(state.modules[m] ?? []).map((l) => ({ value: l.id, label: l.name })),
          ];
          return (
            <Row key={m} gap={8} align="center" style={{ paddingLeft: 16 }}>
              <span style={{ ...muted, width: 72 }}>{label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Select
                  ariaLabel={`${label} layout of ${w.name}`}
                  value={state.parts[w.id]?.[m] ?? ""}
                  options={options}
                  onChange={(value) => c.setPart(w.id, m, value || null)}
                />
              </div>
              {drifted(state, w, m) && (
                <span style={muted} title="Changed since it was taken from its module layout">
                  changed
                </span>
              )}
            </Row>
          );
        })}
        <Row gap={8} align="center" style={{ paddingLeft: 16 }}>
          <span style={{ ...muted, width: 72 }}>Shortcut</span>
          <div style={{ flex: 1 }}>
            <ShortcutField actionId={c.shortcutId(w.id)} />
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showExtensions}
            aria-label={`Extensions for ${w.name}`}
            title="Choose which extensions picking this workspace turns on and off"
            onClick={() => setShowExtensions((v) => !v)}
          >
            Extensions {showExtensions ? "▴" : "▾"}
          </Button>
        </Row>
        {showExtensions && (
          <div style={{ paddingLeft: 16 }}>
            <LayoutExtensionsEditor layoutId={w.id} />
          </div>
        )}
      </Stack>
    </Card>
  );
}

function ModuleLayoutRow(props: { c: Controller; module: string; label: string; l: ModuleLayout; index: number; count: number }) {
  const { c, module, l } = props;
  const { Button, Row } = api.ui;
  const current = c.currentModule() === module;
  const showing = c.showing(module)?.id === l.id;
  const users = c.usedBy(module, l.id).map((w) => w.name);
  return (
    <Row gap={4} align="center">
      <span aria-hidden="true" style={{ width: 12, color: api.ui.tokens.accent }}>
        {showing ? "✓" : ""}
      </span>
      <Name
        name={l.name}
        suffix={showing && c.modified(module) ? " *" : ""}
        label={`${props.label} layout ${l.name}`}
        onRename={(name) => c.renameModuleLayout(module, l.id, name)}
      />
      {users.length > 0 && <span style={muted}>in {users.join(", ")}</span>}
      <Move label={`${props.label} layout ${l.name}`} first={props.index === 0} last={props.index === props.count - 1} onMove={(d) => c.moveModuleLayout(module, l.id, d)} />
      {current && (
        <>
          <Button size="sm" variant="ghost" title={`Show it in ${props.label}`} onClick={() => c.applyModuleLayout(module, l.id)}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={`Save the ${props.label} panels as they are now into it, and every workspace using it`}
            onClick={() => c.updateModuleLayout(module, l.id)}
          >
            Update
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" title="Make a copy" onClick={() => c.duplicateModuleLayout(module, l.id)}>
        Duplicate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Delete ${props.label} layout ${l.name}`}
        title="Delete"
        onClick={async () => {
          const kept = users.length ? ` ${users.join(", ")} keep${users.length === 1 ? "s" : ""} its arrangement.` : "";
          if (await confirmDelete(`“${l.name}”`, kept)) c.deleteModuleLayout(module, l.id);
        }}
      >
        ×
      </Button>
    </Row>
  );
}

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "safelight-layouts.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Manager({ controller: c }: { controller: Controller }) {
  c.useRevision();
  api.layouts.saved.use();
  api.stores.useLayoutStore((s) => `${s.activeId}\n${s.editedFrom ?? ""}`);
  api.stores.useUIStore((s) => s.activeModule);
  const labels = useModuleLabels();
  const { Button, Row, Section, Stack, TextInput } = api.ui;
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const fileInput = React.useRef<HTMLInputElement>(null);
  const workspaces = c.workspaces();
  const state = c.state();

  const saveWorkspace = () => {
    if (!name.trim()) return;
    c.saveWorkspaceAs(name, Object.keys(labels));
    setName("");
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 12 }}>
      <Stack gap={16}>
        <Section title="Workspaces">
          <Stack gap={8}>
            <span style={muted}>
              A workspace picks one layout for each module, and can turn extensions on and off when you pick it.
            </span>
            {workspaces.map((w, i) => (
              <WorkspaceRow key={w.id} c={c} w={w} index={i} count={workspaces.length} labels={labels} />
            ))}
            {workspaces.length === 0 && <span style={muted}>No workspaces yet.</span>}
            <Row gap={6} align="center">
              <div style={{ flex: 1 }}>
                <TextInput
                  value={name}
                  placeholder="Workspace name"
                  aria-label="New workspace name"
                  onChange={setName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveWorkspace();
                  }}
                />
              </div>
              <Button size="sm" disabled={!name.trim()} onClick={saveWorkspace}>
                Save current view as workspace
              </Button>
            </Row>
          </Stack>
        </Section>

        <Section title="Module layouts">
          <Stack gap={12}>
            {Object.entries(labels).map(([m, label]) => {
              const list = state.modules[m] ?? [];
              return (
                <Stack key={m} gap={4}>
                  <span style={{ fontSize: 11, color: api.ui.tokens.textSecondary }}>{label}</span>
                  {list.map((l, i) => (
                    <ModuleLayoutRow key={l.id} c={c} module={m} label={label} l={l} index={i} count={list.length} />
                  ))}
                  {list.length === 0 && <span style={muted}>None saved.</span>}
                </Stack>
              );
            })}
          </Stack>
        </Section>

        <Section title="Share">
          <Stack gap={6}>
            <Row gap={6}>
              <Button size="sm" onClick={() => download(c.exportText())}>
                Export…
              </Button>
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                Import…
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                aria-label="Layouts file to import"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const added = c.importText(await file.text());
                    setNote(`Added ${added.workspaces} workspace${added.workspaces === 1 ? "" : "s"} and ${added.moduleLayouts} module layout${added.moduleLayouts === 1 ? "" : "s"}.`);
                  } catch (err) {
                    setNote(err instanceof Error ? err.message : String(err));
                  }
                }}
              />
            </Row>
            <span style={muted}>
              {note || "A file of every workspace and module layout, to move them to another computer or share them."}
            </span>
          </Stack>
        </Section>
      </Stack>
    </div>
  );
}
