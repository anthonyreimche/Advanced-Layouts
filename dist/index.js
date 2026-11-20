//#region src/model.ts
var e = {
	modules: {},
	parts: {},
	order: []
}, t = (e) => typeof e == "object" && !!e && !Array.isArray(e), n = (e) => typeof e == "number" && Number.isFinite(e) ? Math.round(e) : null;
function r(e) {
	let t = Object.entries(e.floating ?? {}).map(([e, t]) => [
		e,
		n(t.x),
		n(t.y),
		n(t.width)
	]).sort((e, t) => e[0] < t[0] ? -1 : 1);
	return {
		rails: e.rails.map((e) => ({
			side: e.side,
			width: e.side === "bottom" ? null : n(e.width),
			height: e.side === "bottom" ? n(e.height) : null,
			panels: e.panels
		})),
		floating: t,
		collapsed: [...e.collapsed ?? []].sort()
	};
}
function i(e, t) {
	return JSON.stringify(r(e)) === JSON.stringify(r(t));
}
function a(e, t) {
	let n = new Set(t);
	if (!n.has(e)) return e;
	for (let t = 2;; t++) if (!n.has(`${e} ${t}`)) return `${e} ${t}`;
}
function o(e, t, n, r, i) {
	let o = e.modules[t] ?? [], s = {
		id: i,
		name: a(n, o.map((e) => e.name)),
		def: r
	};
	return {
		state: {
			...e,
			modules: {
				...e.modules,
				[t]: [...o, s]
			}
		},
		id: i
	};
}
function s(e, t, n = (e, t) => `${e}:${t}`) {
	let r = new Map(t.map((e) => [e.id, e])), o = [...e.order.filter((e) => r.has(e)), ...t.map((e) => e.id).filter((t) => !e.order.includes(t))], s = { ...e.modules }, c = {};
	for (let t of o) {
		let o = r.get(t), l = {};
		for (let [r, c] of Object.entries(o.modules)) {
			if (!c) continue;
			let u = s[r] ?? [], d = u.find((n) => n.id === e.parts[t]?.[r]) ?? u.find((e) => i(e.def, c));
			if (d) {
				l[r] = d.id;
				continue;
			}
			let f = {
				id: n(t, r),
				name: a(o.name, u.map((e) => e.name)),
				def: c
			};
			s[r] = [...u, f], l[r] = f.id;
		}
		c[t] = l;
	}
	return { state: {
		modules: s,
		parts: c,
		order: o
	} };
}
function c(e, t, n) {
	let r = t.modules[n], a = e.modules[n]?.find((r) => r.id === e.parts[t.id]?.[n]);
	return !!r && !!a && !i(r, a.def);
}
function l(e, t) {
	let n = {};
	for (let [r, i] of Object.entries(t)) {
		let t = e.modules[r]?.find((e) => e.id === i)?.def;
		t && (n[r] = t);
	}
	return n;
}
var u = "safelight-layouts";
function d(e, t) {
	let n = new Map(t.map((e) => [e.id, e.name]));
	return {
		format: u,
		version: 1,
		moduleLayouts: Object.fromEntries(Object.entries(e.modules).map(([e, t]) => [e, t.map(({ name: e, def: t }) => ({
			name: e,
			def: t
		}))])),
		workspaces: e.order.filter((e) => n.has(e)).map((t) => ({
			name: n.get(t),
			parts: Object.fromEntries(Object.entries(e.parts[t] ?? {}).flatMap(([t, n]) => {
				let r = e.modules[t]?.find((e) => e.id === n)?.name;
				return r ? [[t, r]] : [];
			}))
		}))
	};
}
var f = (e) => e === "left" || e === "right" || e === "bottom";
function p(e) {
	if (!t(e) || !Array.isArray(e.rails)) return null;
	let n = [];
	for (let r of e.rails) {
		if (!t(r) || !f(r.side) || !Array.isArray(r.panels)) return null;
		n.push({
			side: r.side,
			...typeof r.width == "number" ? { width: r.width } : {},
			...typeof r.height == "number" ? { height: r.height } : {},
			panels: r.panels.filter((e) => typeof e == "string")
		});
	}
	let r = { rails: n };
	if (t(e.floating)) {
		let n = {};
		for (let [r, i] of Object.entries(e.floating)) t(i) && [
			i.x,
			i.y,
			i.width
		].every((e) => typeof e == "number") && (n[r] = {
			x: i.x,
			y: i.y,
			width: i.width
		});
		Object.keys(n).length && (r.floating = n);
	}
	if (Array.isArray(e.collapsed)) {
		let t = e.collapsed.filter((e) => typeof e == "string");
		t.length && (r.collapsed = t);
	}
	return r;
}
function m(e, n, r, i) {
	if (!t(e) || e.format !== u || e.version !== 1) throw Error("This isn't a Safelight layouts file.");
	let s = n, c = /* @__PURE__ */ new Map(), d = (e, t) => `${e}\n${t}`;
	for (let [n, r] of Object.entries(t(e.moduleLayouts) ? e.moduleLayouts : {})) if (Array.isArray(r)) for (let e of r) {
		let r = t(e) ? p(e.def) : null;
		if (!r || typeof e.name != "string" || !e.name.trim()) continue;
		let a = o(s, n, e.name.trim(), r, i());
		s = a.state, c.has(d(n, e.name.trim())) || c.set(d(n, e.name.trim()), a.id);
	}
	let f = [], m = r.map((e) => e.name);
	for (let n of Array.isArray(e.workspaces) ? e.workspaces : []) {
		if (!t(n) || typeof n.name != "string" || !n.name.trim()) continue;
		let e = {};
		for (let [r, i] of Object.entries(t(n.parts) ? n.parts : {})) {
			let t = typeof i == "string" ? c.get(d(r, i)) : void 0;
			t && (e[r] = t);
		}
		let r = a(n.name.trim(), m);
		m.push(r), f.push({
			name: r,
			modules: l(s, e),
			parts: e
		});
	}
	return {
		state: s,
		creates: f
	};
}
//#endregion
//#region src/controller.ts
var h = "layouts", g = "custom";
function _(t) {
	let n = t.stores.create()(() => ({ n: 0 })), r = () => n.setState((e) => ({ n: e.n + 1 })), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set(), f = 0, p = () => `${Date.now().toString(36)}-${(++f).toString(36)}`, _ = () => t.layouts.saved.list(), y = () => t.settings.get(h, e), b = () => s(y(), _()).state, x = (e) => {
		t.settings.set(h, e), r();
	}, S = () => t.stores.useLayoutStore.getState(), C = () => t.stores.useUIStore.getState().activeModule, w = (e) => _().find((t) => t.id === e), T = (e, t, n) => e.modules[t]?.find((e) => e.id === n);
	function E(e, t) {
		let { activeId: n, editedFrom: r } = S();
		l.set(e, {
			id: t,
			activeId: n,
			editedFrom: r
		});
	}
	function D() {
		let { activeId: e, editedFrom: t } = S();
		return w(e) ? e : e === g && t && w(t) ? t : null;
	}
	function O(e) {
		let t = b(), n = l.get(e), { activeId: r, editedFrom: i } = S();
		if (n && n.activeId === r && n.editedFrom === i) {
			let r = T(t, e, n.id);
			if (r) return r;
		}
		let a = D(), o = a ? t.parts[a]?.[e] : void 0;
		return o && T(t, e, o) || null;
	}
	function k(e) {
		let n = O(e);
		if (!n) return !1;
		if (e === C()) return !t.layouts.shows(n.def);
		let r = t.layouts.capture(e);
		return !!r && !i(r, n.def);
	}
	function A(e) {
		if (D() !== e) return !1;
		if (S().editedFrom === e) return !0;
		let t = w(e), n = b();
		return !!t && Object.keys(t.modules).some((e) => c(n, t, e));
	}
	function j() {
		let e = new Map(_().map((e) => [e.id, e]));
		return b().order.flatMap((t) => e.get(t) ?? []);
	}
	function M(e, n, r) {
		let a = e, s = {}, c = {};
		for (let e of n) {
			let n = t.layouts.capture(e);
			if (!n) continue;
			s[e] = n;
			let l = O(e), u = (l && i(l.def, n) ? l : null) ?? a.modules[e]?.find((e) => i(e.def, n));
			if (u) c[e] = u.id;
			else {
				let t = o(a, e, r, n, p());
				a = t.state, c[e] = t.id;
			}
		}
		return {
			state: a,
			defs: s,
			parts: c
		};
	}
	function N() {
		let { activeId: e, editedFrom: n } = S();
		if (e !== g || !n) return;
		let r = w(n);
		r && Object.entries(r.modules).every(([e, n]) => {
			let r = t.layouts.capture(e);
			return !n || !r || i(r, n);
		}) && t.layouts.apply(n);
	}
	function P(e) {
		l.clear(), t.layouts.apply(e), r();
	}
	function F(e, n) {
		let r = a(e.trim() || "Workspace", _().map((e) => e.name)), i = M(b(), n, r), o = t.layouts.saved.save({
			name: r,
			modules: i.defs
		});
		return x({
			...i.state,
			parts: {
				...i.state.parts,
				[o]: i.parts
			},
			order: [...i.state.order.filter((e) => e !== o), o]
		}), P(o), Q(), o;
	}
	function I(e, n) {
		let r = w(e);
		if (!r) return;
		let i = M(b(), n, r.name);
		t.layouts.saved.save({
			id: e,
			name: r.name,
			modules: {
				...r.modules,
				...i.defs
			}
		}), x({
			...i.state,
			parts: {
				...i.state.parts,
				[e]: {
					...i.state.parts[e],
					...i.parts
				}
			}
		}), S().editedFrom === e && P(e);
	}
	function L(e, n, r) {
		let i = w(e), a = b();
		if (!i) return;
		let o = { ...i.modules }, s = { ...a.parts[e] }, c = r === null ? void 0 : T(a, n, r);
		c ? (o[n] = c.def, s[n] = c.id) : (delete o[n], delete s[n]), t.layouts.saved.save({
			id: e,
			name: i.name,
			modules: o
		}), x({
			...a,
			parts: {
				...a.parts,
				[e]: s
			}
		});
	}
	function R(e, n) {
		let i = w(e);
		if (!i || !n.trim()) return;
		let o = _().filter((t) => t.id !== e).map((e) => e.name);
		t.layouts.saved.save({
			id: e,
			name: a(n.trim(), o),
			modules: i.modules
		}), Q(), r();
	}
	function z(e) {
		let n = w(e);
		if (!n) return e;
		let r = b(), i = t.layouts.saved.save({
			name: a(n.name, _().map((e) => e.name)),
			modules: n.modules
		}), o = r.order.filter((e) => e !== i);
		return o.splice(o.indexOf(e) + 1, 0, i), x({
			...r,
			parts: {
				...r.parts,
				[i]: { ...r.parts[e] }
			},
			order: o
		}), Q(), i;
	}
	function B(e) {
		let n = b();
		t.layouts.saved.remove(e);
		let r = { ...n.parts };
		delete r[e], x({
			...n,
			parts: r,
			order: n.order.filter((t) => t !== e)
		}), Q();
	}
	function V(e, t) {
		let n = b();
		x({
			...n,
			order: v(n.order, e, t)
		});
	}
	function H(e, n) {
		let i = t.layouts.capture(e);
		if (!i) throw Error(`There is no "${e}" module.`);
		let a = o(b(), e, n.trim() || "Layout", i, p());
		return x(a.state), E(e, a.id), r(), a.id;
	}
	function U(e, n) {
		let i = b(), a = T(i, e, n);
		if (!a || e !== C()) return;
		t.layouts.show(a.def);
		let { activeId: o } = S();
		w(o) && x({
			...i,
			parts: {
				...i.parts,
				[o]: {
					...i.parts[o],
					[e]: n
				}
			}
		}), E(e, n), r();
	}
	function W(e, n) {
		let i = t.layouts.capture(e), a = b();
		if (!i || !T(a, e, n)) return;
		let o = {
			...a,
			modules: {
				...a.modules,
				[e]: a.modules[e].map((e) => e.id === n ? {
					...e,
					def: i
				} : e)
			}
		};
		for (let r of j()) o.parts[r.id]?.[e] === n && t.layouts.saved.save({
			id: r.id,
			name: r.name,
			modules: {
				...r.modules,
				[e]: i
			}
		});
		x(o);
		let s = l.get(e);
		N(), s?.id === n && E(e, n), r();
	}
	function G(e) {
		let n = O(e);
		if (!n || e !== C()) return;
		let i = l.get(e), a = D(), { activeId: o, editedFrom: s } = S();
		a && o === g && s === a && t.layouts.apply(a), t.layouts.shows(n.def) || t.layouts.show(n.def), i?.id === n.id && E(e, n.id), r();
	}
	function K(e, t, n) {
		let r = b();
		if (!n.trim() || !T(r, e, t)) return;
		let i = r.modules[e].filter((e) => e.id !== t).map((e) => e.name), o = a(n.trim(), i);
		x({
			...r,
			modules: {
				...r.modules,
				[e]: r.modules[e].map((e) => e.id === t ? {
					...e,
					name: o
				} : e)
			}
		});
	}
	function q(e, t) {
		let n = b(), r = T(n, e, t);
		if (!r) return t;
		let i = o(n, e, r.name, r.def, p()), a = i.state.modules[e].filter((e) => e.id !== i.id);
		return a.splice(a.findIndex((e) => e.id === t) + 1, 0, i.state.modules[e].at(-1)), x({
			...i.state,
			modules: {
				...i.state.modules,
				[e]: a
			}
		}), i.id;
	}
	function J(e, t) {
		let n = b(), r = Object.fromEntries(Object.entries(n.parts).map(([n, r]) => {
			let i = { ...r };
			return i[e] === t && delete i[e], [n, i];
		}));
		x({
			...n,
			modules: {
				...n.modules,
				[e]: n.modules[e].filter((e) => e.id !== t)
			},
			parts: r
		}), l.get(e)?.id === t && l.delete(e);
	}
	function Y(e, t, n) {
		let r = b(), i = r.modules[e] ?? [], a = v(i.map((e) => e.id), t, n);
		x({
			...r,
			modules: {
				...r.modules,
				[e]: a.map((e) => i.find((t) => t.id === e))
			}
		});
	}
	function X(e, t) {
		let n = b();
		return j().filter((r) => n.parts[r.id]?.[e] === t);
	}
	let Z = (e) => `${t.extensionId}.workspace.${e}`;
	function Q() {
		let e = /* @__PURE__ */ new Set();
		for (let n of j()) {
			let r = Z(n.id);
			e.add(r), t.registerKeybinding({
				id: r,
				label: `Switch to workspace: ${n.name}`,
				category: "General",
				defaultCombo: "",
				handler: () => P(n.id)
			}), u.add(r);
		}
		for (let n of u) e.has(n) || (t.unregisterKeybinding(n), u.delete(n));
	}
	function ee() {
		return JSON.stringify(d(b(), j()), null, 2);
	}
	function te(e) {
		let n;
		try {
			n = JSON.parse(e);
		} catch {
			throw Error("This isn't a Safelight layouts file.");
		}
		let r = b(), i = m(n, r, _(), p), a = i.state;
		for (let e of i.creates) {
			let n = t.layouts.saved.save({
				name: e.name,
				modules: e.modules
			});
			a = {
				...a,
				parts: {
					...a.parts,
					[n]: e.parts
				},
				order: [...a.order, n]
			};
		}
		x(a), Q();
		let o = (e) => Object.values(e.modules).reduce((e, t) => e + t.length, 0);
		return {
			workspaces: i.creates.length,
			moduleLayouts: o(a) - o(r)
		};
	}
	let $ = b();
	return JSON.stringify($) !== JSON.stringify(y()) && t.settings.set(h, $), t.settings.onChange((e) => {
		e === h && r();
	}), t.layouts.saved.onChange(() => {
		Q(), r();
	}), {
		useRevision: () => n((e) => e.n),
		state: b,
		workspaces: j,
		activeWorkspace: D,
		workspaceEdited: A,
		showing: O,
		modified: k,
		currentModule: C,
		usedBy: X,
		applyWorkspace: P,
		saveWorkspaceAs: F,
		updateWorkspace: I,
		setPart: L,
		renameWorkspace: R,
		duplicateWorkspace: z,
		deleteWorkspace: B,
		moveWorkspace: V,
		saveModuleLayoutAs: H,
		applyModuleLayout: U,
		updateModuleLayout: W,
		revertModule: G,
		renameModuleLayout: K,
		duplicateModuleLayout: q,
		deleteModuleLayout: J,
		moveModuleLayout: Y,
		shortcutId: Z,
		syncShortcuts: Q,
		exportText: ee,
		importText: te
	};
}
function v(e, t, n) {
	let r = e.indexOf(t);
	if (r < 0) return [...e];
	let i = Math.max(0, Math.min(e.length - 1, r + n)), a = e.filter((e) => e !== t);
	return a.splice(i, 0, t), a;
}
//#endregion
//#region src/ids.ts
var y = "advanced-layouts", b = `${y}.menu`, x = `${y}.manager`, S, C;
function w(e) {
	C = e, S = e.react;
}
//#endregion
//#region src/modules.ts
function T() {
	let e = C.registry.use((e) => e.modules);
	return S.useMemo(() => Object.fromEntries(Object.values(e).sort((e, t) => D(e) - D(t)).map((e) => [e.id, e.label])), [e]);
}
var E = ["library", "develop"];
function D(e) {
	let t = E.indexOf(e.id);
	return t >= 0 ? t - E.length : e.order ?? 100;
}
//#endregion
//#region src/LayoutMenu.tsx
var O = "flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] text-text-secondary hover:bg-surface-3 hover:text-text-primary", k = "px-3 pb-0.5 pt-1.5 text-[9px] uppercase tracking-widest text-text-muted", A = "my-1 border-t border-border-subtle";
function j(e) {
	return /* @__PURE__ */ S.createElement("button", {
		type: "button",
		"aria-pressed": e.checked,
		title: e.title,
		onClick: e.onClick,
		className: O
	}, /* @__PURE__ */ S.createElement("span", {
		"aria-hidden": "true",
		className: "w-3 text-slider-fill"
	}, e.checked ? "✓" : ""), /* @__PURE__ */ S.createElement("span", { className: "truncate" }, e.children), e.hint && /* @__PURE__ */ S.createElement("span", {
		className: "text-text-muted",
		style: {
			marginLeft: "auto",
			paddingLeft: 8
		}
	}, e.hint));
}
function M(e) {
	let [t, n] = S.useState("");
	return /* @__PURE__ */ S.createElement("div", { className: "flex items-center gap-1.5 px-3 py-1" }, /* @__PURE__ */ S.createElement("input", {
		autoFocus: !0,
		value: t,
		placeholder: e.placeholder,
		"aria-label": e.placeholder,
		spellCheck: !1,
		onChange: (e) => n(e.target.value),
		onKeyDown: (n) => {
			n.key === "Enter" && t.trim() && e.onSave(t.trim()), n.key === "Escape" && (n.stopPropagation(), e.onCancel());
		},
		onBlur: e.onCancel,
		className: "min-w-0 flex-1 rounded bg-surface-1 px-1.5 py-0.5 text-[11px] text-text-primary outline-none placeholder:text-text-muted focus:bg-surface-3"
	}));
}
function N({ controller: e, close: t }) {
	e.useRevision(), C.layouts.saved.use(), C.stores.useLayoutStore((e) => `${e.activeId}\n${e.editedFrom ?? ""}`);
	let n = C.stores.useUIStore((e) => e.activeModule), r = T(), [i, a] = S.useState(null), o = Object.keys(r), s = r[n] ?? n, c = e.activeWorkspace(), l = e.showing(n), u = e.modified(n), d = e.state().modules[n] ?? [], f = (e) => () => {
		e(), t();
	};
	return /* @__PURE__ */ S.createElement("div", null, /* @__PURE__ */ S.createElement("div", {
		className: k,
		id: `${b}.workspaces`
	}, "Workspaces"), /* @__PURE__ */ S.createElement("div", {
		role: "group",
		"aria-labelledby": `${b}.workspaces`
	}, e.workspaces().map((t) => /* @__PURE__ */ S.createElement(j, {
		key: t.id,
		checked: c === t.id,
		hint: C.keybindings.getBinding(e.shortcutId(t.id)) || void 0,
		title: e.workspaceEdited(t.id) ? "Changed since it was picked" : void 0,
		onClick: f(() => e.applyWorkspace(t.id))
	}, t.name, e.workspaceEdited(t.id) ? " *" : ""))), i === "workspace" ? /* @__PURE__ */ S.createElement(M, {
		placeholder: "Workspace name",
		onSave: (n) => {
			e.saveWorkspaceAs(n, o), t();
		},
		onCancel: () => a(null)
	}) : /* @__PURE__ */ S.createElement(j, {
		title: "Save every module's arrangement as a new workspace",
		onClick: () => a("workspace")
	}, "Save workspace as…"), /* @__PURE__ */ S.createElement("div", { className: A }), /* @__PURE__ */ S.createElement("div", {
		className: k,
		id: `${b}.module`
	}, s, " layouts"), /* @__PURE__ */ S.createElement("div", {
		role: "group",
		"aria-labelledby": `${b}.module`
	}, d.map((t) => /* @__PURE__ */ S.createElement(j, {
		key: t.id,
		checked: l?.id === t.id,
		onClick: f(() => e.applyModuleLayout(n, t.id))
	}, t.name, l?.id === t.id && u ? " *" : ""))), l && u && /* @__PURE__ */ S.createElement(S.Fragment, null, /* @__PURE__ */ S.createElement(j, {
		title: `Save the ${s} panels as they are now into “${l.name}”, and every workspace using it`,
		onClick: f(() => e.updateModuleLayout(n, l.id))
	}, "Update “", l.name, "”"), /* @__PURE__ */ S.createElement(j, {
		title: `Put the ${s} panels back as “${l.name}” has them`,
		onClick: f(() => e.revertModule(n))
	}, "Revert to “", l.name, "”")), i === "module" ? /* @__PURE__ */ S.createElement(M, {
		placeholder: `${s} layout name`,
		onSave: (r) => {
			e.saveModuleLayoutAs(n, r), t();
		},
		onCancel: () => a(null)
	}) : /* @__PURE__ */ S.createElement(j, { onClick: () => a("module") }, "Save current ", s, " layout as…"), /* @__PURE__ */ S.createElement("div", { className: A }), /* @__PURE__ */ S.createElement(j, {
		title: "Rename, reorder, export and import layouts and workspaces",
		onClick: f(() => C.windows.open(x))
	}, "Manage layouts…"));
}
//#endregion
//#region src/Manager.tsx
var P = {
	color: "var(--color-text-muted)",
	fontSize: 11
};
function F(e) {
	let { TextInput: t } = C.ui, [n, r] = S.useState(null);
	if (n === null) return /* @__PURE__ */ S.createElement("button", {
		type: "button",
		title: "Rename",
		"aria-label": `Rename ${e.label}`,
		onClick: () => r(e.name),
		style: {
			all: "unset",
			cursor: "text",
			fontSize: 12,
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: C.ui.tokens.textPrimary
		}
	}, e.name, e.suffix);
	let i = () => {
		n.trim() && n.trim() !== e.name && e.onRename(n.trim()), r(null);
	};
	return /* @__PURE__ */ S.createElement("div", { style: {
		flex: 1,
		minWidth: 0
	} }, /* @__PURE__ */ S.createElement(t, {
		autoFocus: !0,
		value: n,
		"aria-label": `New name for ${e.label}`,
		onChange: r,
		onBlur: i,
		onKeyDown: (e) => {
			e.key === "Enter" && i(), e.key === "Escape" && (e.stopPropagation(), r(null));
		}
	}));
}
function I(e) {
	let { Button: t } = C.ui;
	return /* @__PURE__ */ S.createElement(S.Fragment, null, /* @__PURE__ */ S.createElement(t, {
		size: "sm",
		variant: "ghost",
		title: "Move up",
		"aria-label": `Move ${e.label} up`,
		disabled: e.first,
		onClick: () => e.onMove(-1)
	}, "↑"), /* @__PURE__ */ S.createElement(t, {
		size: "sm",
		variant: "ghost",
		title: "Move down",
		"aria-label": `Move ${e.label} down`,
		disabled: e.last,
		onClick: () => e.onMove(1)
	}, "↓"));
}
async function L(e, t = "") {
	return C.ui.confirmDialog({
		title: `Delete ${e}?`,
		message: `${e} will be deleted.${t}`,
		confirmLabel: "Delete",
		variant: "danger"
	});
}
function R(e) {
	let { c: t, w: n, labels: r } = e, { Button: i, Select: a, Row: o, Stack: s, Card: l } = C.ui, { ShortcutField: u, LayoutExtensionsEditor: d } = C.components, f = t.state(), p = t.activeWorkspace() === n.id, [m, h] = S.useState(!1);
	return /* @__PURE__ */ S.createElement(l, null, /* @__PURE__ */ S.createElement(s, { gap: 6 }, /* @__PURE__ */ S.createElement(o, {
		gap: 4,
		align: "center"
	}, /* @__PURE__ */ S.createElement("span", {
		"aria-hidden": "true",
		style: {
			width: 12,
			color: C.ui.tokens.accent
		}
	}, p ? "✓" : ""), /* @__PURE__ */ S.createElement(F, {
		name: n.name,
		suffix: t.workspaceEdited(n.id) ? " *" : "",
		label: `workspace ${n.name}`,
		onRename: (e) => t.renameWorkspace(n.id, e)
	}), /* @__PURE__ */ S.createElement(I, {
		label: `workspace ${n.name}`,
		first: e.index === 0,
		last: e.index === e.count - 1,
		onMove: (e) => t.moveWorkspace(n.id, e)
	}), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		onClick: () => t.applyWorkspace(n.id),
		title: "Switch to this workspace"
	}, "Apply"), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: "Save every module's arrangement as it is now into this workspace",
		onClick: () => t.updateWorkspace(n.id, Object.keys(r))
	}, "Update"), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: "Make a copy of this workspace",
		onClick: () => t.duplicateWorkspace(n.id)
	}, "Duplicate"), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: "Delete this workspace",
		"aria-label": `Delete workspace ${n.name}`,
		onClick: async () => {
			await L(`“${n.name}”`, " Its module layouts are kept.") && t.deleteWorkspace(n.id);
		}
	}, "×")), Object.entries(r).map(([e, r]) => {
		let i = [{
			value: "",
			label: "Default"
		}, ...(f.modules[e] ?? []).map((e) => ({
			value: e.id,
			label: e.name
		}))];
		return /* @__PURE__ */ S.createElement(o, {
			key: e,
			gap: 8,
			align: "center",
			style: { paddingLeft: 16 }
		}, /* @__PURE__ */ S.createElement("span", { style: {
			...P,
			width: 72
		} }, r), /* @__PURE__ */ S.createElement("div", { style: {
			flex: 1,
			minWidth: 0
		} }, /* @__PURE__ */ S.createElement(a, {
			ariaLabel: `${r} layout of ${n.name}`,
			value: f.parts[n.id]?.[e] ?? "",
			options: i,
			onChange: (r) => t.setPart(n.id, e, r || null)
		})), c(f, n, e) && /* @__PURE__ */ S.createElement("span", {
			style: P,
			title: "Changed since it was taken from its module layout"
		}, "changed"));
	}), /* @__PURE__ */ S.createElement(o, {
		gap: 8,
		align: "center",
		style: { paddingLeft: 16 }
	}, /* @__PURE__ */ S.createElement("span", { style: {
		...P,
		width: 72
	} }, "Shortcut"), /* @__PURE__ */ S.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ S.createElement(u, { actionId: t.shortcutId(n.id) })), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		"aria-expanded": m,
		"aria-label": `Extensions for ${n.name}`,
		title: "Choose which extensions picking this workspace turns on and off",
		onClick: () => h((e) => !e)
	}, "Extensions ", m ? "▴" : "▾")), m && /* @__PURE__ */ S.createElement("div", { style: { paddingLeft: 16 } }, /* @__PURE__ */ S.createElement(d, { layoutId: n.id }))));
}
function z(e) {
	let { c: t, module: n, l: r } = e, { Button: i, Row: a } = C.ui, o = t.currentModule() === n, s = t.showing(n)?.id === r.id, c = t.usedBy(n, r.id).map((e) => e.name);
	return /* @__PURE__ */ S.createElement(a, {
		gap: 4,
		align: "center"
	}, /* @__PURE__ */ S.createElement("span", {
		"aria-hidden": "true",
		style: {
			width: 12,
			color: C.ui.tokens.accent
		}
	}, s ? "✓" : ""), /* @__PURE__ */ S.createElement(F, {
		name: r.name,
		suffix: s && t.modified(n) ? " *" : "",
		label: `${e.label} layout ${r.name}`,
		onRename: (e) => t.renameModuleLayout(n, r.id, e)
	}), c.length > 0 && /* @__PURE__ */ S.createElement("span", { style: P }, "in ", c.join(", ")), /* @__PURE__ */ S.createElement(I, {
		label: `${e.label} layout ${r.name}`,
		first: e.index === 0,
		last: e.index === e.count - 1,
		onMove: (e) => t.moveModuleLayout(n, r.id, e)
	}), o && /* @__PURE__ */ S.createElement(S.Fragment, null, /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: `Show it in ${e.label}`,
		onClick: () => t.applyModuleLayout(n, r.id)
	}, "Apply"), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: `Save the ${e.label} panels as they are now into it, and every workspace using it`,
		onClick: () => t.updateModuleLayout(n, r.id)
	}, "Update")), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		title: "Make a copy",
		onClick: () => t.duplicateModuleLayout(n, r.id)
	}, "Duplicate"), /* @__PURE__ */ S.createElement(i, {
		size: "sm",
		variant: "ghost",
		"aria-label": `Delete ${e.label} layout ${r.name}`,
		title: "Delete",
		onClick: async () => {
			let e = c.length ? ` ${c.join(", ")} keep${c.length === 1 ? "s" : ""} its arrangement.` : "";
			await L(`“${r.name}”`, e) && t.deleteModuleLayout(n, r.id);
		}
	}, "×"));
}
function B(e) {
	let t = URL.createObjectURL(new Blob([e], { type: "application/json" })), n = document.createElement("a");
	n.href = t, n.download = "safelight-layouts.json", n.click(), setTimeout(() => URL.revokeObjectURL(t), 1e3);
}
function V({ controller: e }) {
	e.useRevision(), C.layouts.saved.use(), C.stores.useLayoutStore((e) => `${e.activeId}\n${e.editedFrom ?? ""}`), C.stores.useUIStore((e) => e.activeModule);
	let t = T(), { Button: n, Row: r, Section: i, Stack: a, TextInput: o } = C.ui, [s, c] = S.useState(""), [l, u] = S.useState(""), d = S.useRef(null), f = e.workspaces(), p = e.state(), m = () => {
		s.trim() && (e.saveWorkspaceAs(s, Object.keys(t)), c(""));
	};
	return /* @__PURE__ */ S.createElement("div", { style: {
		height: "100%",
		overflowY: "auto",
		padding: 12
	} }, /* @__PURE__ */ S.createElement(a, { gap: 16 }, /* @__PURE__ */ S.createElement(i, { title: "Workspaces" }, /* @__PURE__ */ S.createElement(a, { gap: 8 }, /* @__PURE__ */ S.createElement("span", { style: P }, "A workspace picks one layout for each module, and can turn extensions on and off when you pick it."), f.map((n, r) => /* @__PURE__ */ S.createElement(R, {
		key: n.id,
		c: e,
		w: n,
		index: r,
		count: f.length,
		labels: t
	})), f.length === 0 && /* @__PURE__ */ S.createElement("span", { style: P }, "No workspaces yet."), /* @__PURE__ */ S.createElement(r, {
		gap: 6,
		align: "center"
	}, /* @__PURE__ */ S.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ S.createElement(o, {
		value: s,
		placeholder: "Workspace name",
		"aria-label": "New workspace name",
		onChange: c,
		onKeyDown: (e) => {
			e.key === "Enter" && m();
		}
	})), /* @__PURE__ */ S.createElement(n, {
		size: "sm",
		disabled: !s.trim(),
		onClick: m
	}, "Save current view as workspace")))), /* @__PURE__ */ S.createElement(i, { title: "Module layouts" }, /* @__PURE__ */ S.createElement(a, { gap: 12 }, Object.entries(t).map(([t, n]) => {
		let r = p.modules[t] ?? [];
		return /* @__PURE__ */ S.createElement(a, {
			key: t,
			gap: 4
		}, /* @__PURE__ */ S.createElement("span", { style: {
			fontSize: 11,
			color: C.ui.tokens.textSecondary
		} }, n), r.map((i, a) => /* @__PURE__ */ S.createElement(z, {
			key: i.id,
			c: e,
			module: t,
			label: n,
			l: i,
			index: a,
			count: r.length
		})), r.length === 0 && /* @__PURE__ */ S.createElement("span", { style: P }, "None saved."));
	}))), /* @__PURE__ */ S.createElement(i, { title: "Share" }, /* @__PURE__ */ S.createElement(a, { gap: 6 }, /* @__PURE__ */ S.createElement(r, { gap: 6 }, /* @__PURE__ */ S.createElement(n, {
		size: "sm",
		onClick: () => B(e.exportText())
	}, "Export…"), /* @__PURE__ */ S.createElement(n, {
		size: "sm",
		onClick: () => d.current?.click()
	}, "Import…"), /* @__PURE__ */ S.createElement("input", {
		ref: d,
		type: "file",
		accept: ".json,application/json",
		"aria-label": "Layouts file to import",
		style: { display: "none" },
		onChange: async (t) => {
			let n = t.target.files?.[0];
			if (t.target.value = "", n) try {
				let t = e.importText(await n.text());
				u(`Added ${t.workspaces} workspace${t.workspaces === 1 ? "" : "s"} and ${t.moduleLayouts} module layout${t.moduleLayouts === 1 ? "" : "s"}.`);
			} catch (e) {
				u(e instanceof Error ? e.message : String(e));
			}
		}
	})), /* @__PURE__ */ S.createElement("span", { style: P }, l || "A file of every workspace and module layout, to move them to another computer or share them.")))));
}
//#endregion
//#region src/index.tsx
function H(e) {
	w(e);
	let t = _(e);
	e.registerLayoutMenu({
		id: b,
		replacesSavedLayouts: !0,
		component: ({ close: e }) => /* @__PURE__ */ S.createElement(N, {
			controller: t,
			close: e
		})
	}), e.registerWindow({
		id: x,
		title: "Layouts",
		maximizable: !0,
		component: () => /* @__PURE__ */ S.createElement(V, { controller: t })
	}), t.syncShortcuts();
}
//#endregion
export { H as activate };

//# sourceMappingURL=index.js.map