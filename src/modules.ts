// The registered modules (Library, Develop, Map…) by id, with their tab labels,
// in tab order: Library and Develop lead, as in the module strip.

import { React, api } from "./rt";

export function useModuleLabels(): Record<string, string> {
  const modules = api.registry.use((s) => s.modules);
  return React.useMemo(
    () =>
      Object.fromEntries(
        Object.values(modules)
          .sort((a, b) => rank(a) - rank(b))
          .map((m) => [m.id, m.label]),
      ),
    [modules],
  );
}

const LEADING = ["library", "develop"];

function rank(m: { id: string; order?: number }): number {
  const lead = LEADING.indexOf(m.id);
  return lead >= 0 ? lead - LEADING.length : (m.order ?? 100);
}
