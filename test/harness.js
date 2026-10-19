"use strict";

/*
 * love-tasks — Node harness (dependency-free, fake DOM).
 *
 *   node test/harness.js
 *
 * Loads js/app.js inside a vm sandbox with a minimal DOM stand-in and asserts
 * the pure logic exposed on window.MenaTasks.
 */

const fs = require("fs");
const vm = require("vm");

const store = {};
const el = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {} },
  dataset: {},
  appendChild() {},
  addEventListener() {},
  setAttribute() {},
  removeAttribute() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  focus() {},
  remove() {},
  innerHTML: "",
  textContent: "",
  value: ""
});

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  Intl,
  URLSearchParams,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => el(),
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } }
  },
  navigator: { language: "en", clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of process.argv.slice(2).length ? process.argv.slice(2) : ["js/app.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
}

const T = sandbox.window.MenaTasks;

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); failed += 1; }
  else console.log("ok - " + msg);
}
function eq(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) { console.error("FAIL: " + msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); failed += 1; }
  else console.log("ok - " + msg);
}

/* ---- namespace ---- */
assert(!!T, "namespace window.MenaTasks is exposed");
assert(T && T.STORE === "mena-tasks", "storage key is mena-tasks");

/* ---- day math ---- */
eq(T.dayISO(new Date(2026, 0, 5)), "2026-01-05", "dayISO pads month/day");
eq(T.daysUntil("2026-01-10", "2026-01-05"), 5, "daysUntil counts forward days");
eq(T.daysUntil("2026-01-01", "2026-01-05"), -4, "daysUntil is negative when overdue");
eq(T.daysUntil("", "2026-01-05"), null, "daysUntil null without a due date");
eq(T.dueLabel("2026-01-05", "2026-01-05"), "today", "dueLabel today");
eq(T.dueLabel("2026-01-06", "2026-01-05"), "tomorrow", "dueLabel tomorrow");
eq(T.dueLabel("2026-01-08", "2026-01-05"), "in 3 days", "dueLabel in N days");
eq(T.dueLabel("2026-01-03", "2026-01-05"), "overdue by 2 days", "dueLabel overdue");
eq(T.dueLabel("", "2026-01-05"), "", "dueLabel empty without a due date");

/* ---- priority normalisation ---- */
eq(T.normalizePrio("high"), "high", "normalizePrio keeps high");
eq(T.normalizePrio("nonsense"), "med", "normalizePrio falls back to med");

/* ---- escaping ---- */
eq(T.escapeHtml('<b>&"x"</b>'), "&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;", "escapeHtml escapes markup");

/* ---- progress ---- */
eq(T.progress([]), { done: 0, total: 0, percent: 0 }, "progress of an empty list");
eq(T.progress([{ done: true }, { done: false }, { done: true }]), { done: 2, total: 3, percent: 67 }, "progress counts done + percent");
eq(T.subsProgress([{ done: true }, { done: false }]), { done: 1, total: 2 }, "subsProgress counts subtasks");

/* ---- filter ---- */
const items = [{ id: "a", done: true }, { id: "b", done: false }];
eq(T.filterItems(items, "all").length, 2, "filter all keeps everything");
eq(T.filterItems(items, "active").map((i) => i.id), ["b"], "filter active keeps open tasks");
eq(T.filterItems(items, "done").map((i) => i.id), ["a"], "filter done keeps finished tasks");

/* ---- lists + items ---- */
const st = T.emptyState();
const list = T.addList(st, "Groceries");
assert(!!list && list.name === "Groceries", "addList creates a named list");
eq(st.lists.length, 1, "state has one list");
const it1 = T.addItem(list, "Milk", "high", "2026-01-10");
const it2 = T.addItem(list, "Pizza", "low", "");
assert(!!it1 && !!it2, "addItem adds tasks");
eq(T.addItem(list, "   ", "med", ""), null, "addItem rejects blank text");
eq(it1.prio, "high", "item keeps its priority");
eq(it1.due, "2026-01-10", "item keeps its due date");

/* ---- subtasks ---- */
const s1 = T.addSub(it1, "check the date");
assert(!!s1, "addSub adds a subtask");
eq(T.addSub(it1, "  "), null, "addSub rejects blank text");
eq(T.subsProgress(it1.subs), { done: 0, total: 1 }, "subsProgress after adding one");
T.toggleSub(it1, s1.id, true);
eq(T.subsProgress(it1.subs).done, 1, "toggleSub marks a subtask done");
T.toggleSub(it1, s1.id);
eq(T.subsProgress(it1.subs).done, 0, "toggleSub toggles again");
assert(T.removeSub(it1, s1.id), "removeSub removes a subtask");
eq(it1.subs.length, 0, "subtask list is empty after removal");

/* ---- reorder ---- */
eq(list.items.map((i) => i.id), [it1.id, it2.id], "items start in insertion order");
assert(T.moveItem(list, it1.id, 1), "moveItem down reports success");
eq(list.items.map((i) => i.id), [it2.id, it1.id], "moveItem down swaps");
assert(!T.moveItem(list, it2.id, -1), "moveItem refuses to leave the top");
assert(T.moveItem(list, it2.id, 1), "moveItem back down");
assert(!T.moveItem(list, "missing", 1), "moveItem ignores unknown ids");

/* ---- clear completed ---- */
T.addItem(list, "Water", "med", "");
const before = list.items.length;
list.items[0].done = true;
const removed = T.clearCompleted(list);
eq(removed, 1, "clearCompleted reports how many it removed");
eq(list.items.length, before - 1, "clearCompleted shrinks the list");

/* ---- totals ---- */
const st2 = T.emptyState();
const l2 = T.addList(st2, "Trips");
T.addItem(l2, "Bucharest", "high", "");
T.addItem(l2, "Karachi", "med", "");
l2.items[1].done = true;
eq(T.totals(st2), { lists: 1, tasks: 2, done: 1, open: 1 }, "totals summarises every list");

/* ---- normalisation round-trip ---- */
const round = T.normalizeState(JSON.parse(JSON.stringify(st2)));
eq(round.lists[0].items.length, 2, "normalizeState keeps items");
eq(round.lists[0].items[0].prio, "high", "normalizeState keeps priorities");
eq(T.normalizeState(null), { lists: [] }, "normalizeState tolerates null");
eq(T.normalizeState({ lists: "nope" }), { lists: [] }, "normalizeState rejects a bad shape");
eq(T.normalizeState({ lists: [{ items: [{ text: "" }] }] }).lists[0].items.length, 0, "normalizeState drops blank items");

/* ---- findList ---- */
assert(T.findList(st2, l2.id) === l2, "findList finds a list by id");
assert(T.findList(st2, "nope") === null, "findList returns null for unknown ids");

/* ---- remove list ---- */
assert(T.removeList(st2, l2.id), "removeList removes a list");
eq(st2.lists.length, 0, "list is gone after removal");

console.log("");
if (failed) {
  console.error(failed + " assertion(s) failed");
  process.exitCode = 1;
} else {
  console.log("All assertions passed ♥");
}
