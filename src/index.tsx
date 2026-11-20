// The entry point. Safelight imports dist/index.js (built from this file) and
// calls activate() once with the API, scoped to this extension.

import { createController } from "./controller";
import { MANAGER_ID, MENU_ID } from "./ids";
import { LayoutMenuSection } from "./LayoutMenu";
import { Manager } from "./Manager";
import { React, initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  const controller = createController(host);
  host.registerLayoutMenu({
    id: MENU_ID,
    replacesSavedLayouts: true,
    component: ({ close }) => <LayoutMenuSection controller={controller} close={close} />,
  });
  host.registerWindow({
    id: MANAGER_ID,
    title: "Layouts",
    maximizable: true,
    component: () => <Manager controller={controller} />,
  });
  controller.syncShortcuts();
}
