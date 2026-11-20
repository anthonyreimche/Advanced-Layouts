# Advanced Layouts for Safelight

Save a panel layout for one module at a time, combine them into workspaces, and manage both in one place.

- **Module layouts.** Choose **Layout ▸ Save current Develop layout as…** to keep the Develop panels as they are under a name. Each module keeps its own list: Library, Develop, and modules from extensions such as Map or Print.
- **Workspaces.** A workspace picks one layout for each module, for example:
  - **Culling**: Library "Grid only" with Develop "Minimal"
  - **RAW editing**: Library "Filmstrip" with Develop "RAW"

  Choose **Layout ▸ Save workspace as…** to save every module as it is now. Pick a workspace from the Layout menu, or bind it a shortcut.
- **Changed, not Custom.** Move or resize a panel and the layout shows as changed, such as "RAW *", with **Update "RAW"** to keep the change and **Revert to "RAW"** to put the panels back. Updating a module layout updates every workspace that uses it.
- **One place to manage them.** **Layout ▸ Manage layouts…** opens the Layouts window. There you can rename, duplicate, update, delete and reorder workspaces and module layouts. You can also pick each workspace's layout for each module, its shortcut and the extensions it switches, and export or import everything as a file to share or move to another computer.

Your saved layouts become workspaces when you install this extension, and each of their modules becomes a module layout. A workspace is still a saved layout as far as Safelight is concerned, so it keeps switching the extensions you ticked for it. Choose which ones under its **Extensions** button in the Layouts window, and click its **Shortcut** there to bind a key. Both are the same settings Preferences shows: the extensions under the saved layout in Preferences ▸ Interface, the shortcut as "Switch to workspace: …" in Preferences ▸ Shortcuts.

Needs Safelight 3.2.6.

## Notes

- Clicking a module layout while a workspace is showing makes it that workspace's layout for the module.
- Deleting a module layout leaves the workspaces that used it as they are.
- Duplicating a workspace doesn't copy the extensions it switches. Tick them for the copy under its **Extensions** button.
- A popped-out module window keeps its own arrangement. The Layout menu acts on the main window.

## Develop

```bash
npm install
npm run check    # typecheck, build, then test
```

`src/model.ts` is the pure model: comparing arrangements, linking workspaces to module layouts, and the layouts file. `src/controller.ts` drives Safelight's `api.layouts`. `src/LayoutMenu.tsx` is the Layout menu section, and `src/Manager.tsx` is the Layouts window. Tests run against the fake API in `test/support/fake-api.ts`.

## Licence

GPL-3.0-only. See `LICENSE`.
