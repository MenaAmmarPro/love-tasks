"use strict";

/*
 * love-tasks — shared to-do lists.
 *
 * Lists of little things we do together. Every list and every task lives in
 * localStorage on this device only ("mena-tasks"); nothing leaves the browser.
 *
 * All the thinking lives in pure functions, exposed as window.MenaTasks so the
 * Node harness can exercise them without a browser.
 */

(function () {
  var STORE = "mena-tasks";

  var PRIOS = ["low", "med", "high"];

  /* ---------------- small helpers ---------------- */

  function uid(prefix) {
    return (prefix || "id") + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function dayISO(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseDay(iso) {
    var parts = String(iso).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function daysUntil(due, today) {
    if (!due) return null;
    var t = parseDay(today || dayISO());
    var d = parseDay(due);
    return Math.round((d - t) / 86400000);
  }

  function dueLabel(due, today) {
    if (!due) return "";
    var n = daysUntil(due, today);
    if (n < 0) return "overdue by " + Math.abs(n) + (Math.abs(n) === 1 ? " day" : " days");
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    return "in " + n + " days";
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clean(text, max) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, max || 200);
  }

  function normalizePrio(p) {
    return PRIOS.indexOf(p) >= 0 ? p : "med";
  }

  /* ---------------- pure state logic ---------------- */

  function emptyState() {
    return { lists: [] };
  }

  function newSub(text) {
    return { id: uid("s"), text: clean(text, 160), done: false };
  }

  function newItem(text, prio, due) {
    return {
      id: uid("i"),
      text: clean(text, 200),
      done: false,
      due: due || "",
      prio: normalizePrio(prio),
      subs: []
    };
  }

  function newList(name) {
    return {
      id: uid("l"),
      name: clean(name, 80) || "A new list",
      items: []
    };
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    var text = clean(raw.text, 200);
    if (!text) return null;
    var subs = [];
    if (Array.isArray(raw.subs)) {
      raw.subs.forEach(function (s) {
        if (s && typeof s.text === "string" && s.text.trim()) {
          subs.push({ id: typeof s.id === "string" ? s.id : uid("s"), text: clean(s.text, 160), done: !!s.done });
        }
      });
    }
    return {
      id: typeof raw.id === "string" ? raw.id : uid("i"),
      text: text,
      done: !!raw.done,
      due: typeof raw.due === "string" ? raw.due : "",
      prio: normalizePrio(raw.prio),
      subs: subs
    };
  }

  function normalizeState(raw) {
    var state = emptyState();
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.lists)) return state;
    raw.lists.forEach(function (l) {
      if (!l || typeof l !== "object") return;
      var list = { id: typeof l.id === "string" ? l.id : uid("l"), name: clean(l.name, 80) || "Untitled list", items: [] };
      if (Array.isArray(l.items)) {
        l.items.forEach(function (it) {
          var item = normalizeItem(it);
          if (item) list.items.push(item);
        });
      }
      state.lists.push(list);
    });
    return state;
  }

  function findList(state, id) {
    if (!state || !Array.isArray(state.lists)) return null;
    for (var i = 0; i < state.lists.length; i += 1) {
      if (state.lists[i].id === id) return state.lists[i];
    }
    return null;
  }

  function findItem(list, id) {
    if (!list || !Array.isArray(list.items)) return null;
    for (var i = 0; i < list.items.length; i += 1) {
      if (list.items[i].id === id) return list.items[i];
    }
    return null;
  }

  function progress(items) {
    var total = items ? items.length : 0;
    var done = 0;
    if (items) {
      items.forEach(function (it) { if (it.done) done += 1; });
    }
    var percent = total ? Math.round((done / total) * 100) : 0;
    return { done: done, total: total, percent: percent };
  }

  function subsProgress(subs) {
    var total = subs ? subs.length : 0;
    var done = 0;
    if (subs) {
      subs.forEach(function (s) { if (s.done) done += 1; });
    }
    return { done: done, total: total };
  }

  function filterItems(items, filter) {
    var all = items || [];
    if (filter === "active") return all.filter(function (it) { return !it.done; });
    if (filter === "done") return all.filter(function (it) { return it.done; });
    return all.slice();
  }

  function addList(state, name) {
    var list = newList(name);
    state.lists.push(list);
    return list;
  }

  function removeList(state, id) {
    for (var i = 0; i < state.lists.length; i += 1) {
      if (state.lists[i].id === id) {
        state.lists.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function addItem(list, text, prio, due) {
    if (!list) return null;
    var t = clean(text, 200);
    if (!t) return null;
    var item = newItem(t, prio, due);
    list.items.push(item);
    return item;
  }

  function removeItem(list, id) {
    if (!list) return false;
    for (var i = 0; i < list.items.length; i += 1) {
      if (list.items[i].id === id) {
        list.items.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /* Move an item one slot up (-1) or down (+1). Returns true when it moved. */
  function moveItem(list, id, delta) {
    if (!list) return false;
    var i;
    for (i = 0; i < list.items.length; i += 1) {
      if (list.items[i].id === id) break;
    }
    if (i >= list.items.length) return false;
    var j = i + delta;
    if (j < 0 || j >= list.items.length) return false;
    var tmp = list.items[i];
    list.items[i] = list.items[j];
    list.items[j] = tmp;
    return true;
  }

  function clearCompleted(list) {
    if (!list) return 0;
    var before = list.items.length;
    list.items = list.items.filter(function (it) { return !it.done; });
    return before - list.items.length;
  }

  function addSub(item, text) {
    if (!item) return null;
    var t = clean(text, 160);
    if (!t) return null;
    var sub = newSub(t);
    item.subs.push(sub);
    return sub;
  }

  function toggleSub(item, subId, done) {
    if (!item) return false;
    for (var i = 0; i < item.subs.length; i += 1) {
      if (item.subs[i].id === subId) {
        item.subs[i].done = done == null ? !item.subs[i].done : !!done;
        return true;
      }
    }
    return false;
  }

  function removeSub(item, subId) {
    if (!item) return false;
    for (var i = 0; i < item.subs.length; i += 1) {
      if (item.subs[i].id === subId) {
        item.subs.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /* A tidy overview across every list. */
  function totals(state) {
    var out = { lists: 0, tasks: 0, done: 0, open: 0 };
    if (!state || !Array.isArray(state.lists)) return out;
    out.lists = state.lists.length;
    state.lists.forEach(function (l) {
      l.items.forEach(function (it) {
        out.tasks += 1;
        if (it.done) out.done += 1; else out.open += 1;
      });
    });
    return out;
  }

  /* ---------------- storage ---------------- */

  var state = emptyState();

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE); } catch (e) { raw = null; }
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    state = normalizeState(parsed);
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------------- namespace ---------------- */

  var root = (typeof window !== "undefined") ? window
    : (typeof globalThis !== "undefined") ? globalThis : this;

  root.MenaTasks = {
    STORE: STORE,
    PRIOS: PRIOS,
    uid: uid,
    dayISO: dayISO,
    daysUntil: daysUntil,
    dueLabel: dueLabel,
    escapeHtml: escapeHtml,
    clean: clean,
    normalizePrio: normalizePrio,
    emptyState: emptyState,
    normalizeState: normalizeState,
    findList: findList,
    findItem: findItem,
    progress: progress,
    subsProgress: subsProgress,
    filterItems: filterItems,
    addList: addList,
    removeList: removeList,
    addItem: addItem,
    removeItem: removeItem,
    moveItem: moveItem,
    clearCompleted: clearCompleted,
    addSub: addSub,
    toggleSub: toggleSub,
    removeSub: removeSub,
    totals: totals,
    load: load,
    save: save,
    getState: function () { return state; }
  };

  /* ---------------- rendering (browser only) ---------------- */

  var activeListId = null;
  var filter = "all";

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function note(id, message) { setText(id, message); }

  function currentList() {
    return findList(state, activeListId);
  }

  function renderListChips() {
    var wrap = document.getElementById("list-chips");
    if (!wrap) return;
    wrap.textContent = "";
    if (!state.lists.length) {
      var empty = el("p", "list-empty");
      empty.textContent = "No lists yet \u2014 make the first one below.";
      wrap.appendChild(empty);
      return;
    }
    state.lists.forEach(function (list) {
      var chip = el("button", "list-chip" + (list.id === activeListId ? " is-active" : ""));
      chip.type = "button";
      var name = el("span", "list-chip-name");
      name.textContent = list.name;
      chip.appendChild(name);
      var p = progress(list.items);
      var badge = el("span", "list-chip-count");
      badge.textContent = p.done + "/" + p.total;
      chip.appendChild(badge);
      chip.addEventListener("click", function () {
        activeListId = list.id;
        render();
      });
      wrap.appendChild(chip);
    });
  }

  function renderItem(list, item) {
    var row = el("li", "task" + (item.done ? " is-done" : ""));
    row.setAttribute("data-id", item.id);
    row.setAttribute("data-prio", item.prio);

    var check = el("input", "task-check");
    check.type = "checkbox";
    check.checked = !!item.done;
    check.setAttribute("aria-label", "Mark done");
    check.addEventListener("change", function () {
      item.done = check.checked;
      save();
      render();
    });
    row.appendChild(check);

    var main = el("div", "task-main");

    var head = el("div", "task-head");
    var text = el("span", "task-text");
    text.textContent = item.text;
    head.appendChild(text);

    var prio = el("span", "task-prio is-" + item.prio);
    prio.textContent = item.prio;
    head.appendChild(prio);

    if (item.due) {
      var due = el("span", "task-due" + (daysUntil(item.due) < 0 && !item.done ? " is-overdue" : ""));
      due.textContent = "\u2691 " + dueLabel(item.due) + " \u00b7 " + item.due;
      head.appendChild(due);
    }
    main.appendChild(head);

    if (item.subs.length) {
      var sp = subsProgress(item.subs);
      var subMeta = el("span", "task-submeta");
      subMeta.textContent = sp.done + " of " + sp.total + " subtasks";
      main.appendChild(subMeta);

      var subList = el("ul", "subtasks");
      item.subs.forEach(function (sub) {
        var li = el("li", "subtask" + (sub.done ? " is-done" : ""));
        var cb = el("input", "sub-check");
        cb.type = "checkbox";
        cb.checked = !!sub.done;
        cb.setAttribute("aria-label", "Toggle subtask");
        cb.addEventListener("change", function () { toggleSub(item, sub.id, cb.checked); save(); render(); });
        li.appendChild(cb);
        var st = el("span", "sub-text");
        st.textContent = sub.text;
        li.appendChild(st);
        var rm = el("button", "sub-remove");
        rm.type = "button";
        rm.textContent = "\u00d7";
        rm.setAttribute("aria-label", "Remove subtask");
        rm.addEventListener("click", function () { removeSub(item, sub.id); save(); render(); });
        li.appendChild(rm);
        subList.appendChild(li);
      });
      main.appendChild(subList);
    }

    var subForm = el("form", "sub-form");
    var subInput = el("input", "sub-input");
    subInput.type = "text";
    subInput.placeholder = "Add a step\u2026";
    subInput.maxLength = 160;
    subForm.appendChild(subInput);
    var subBtn = el("button", "sub-add");
    subBtn.type = "submit";
    subBtn.textContent = "+ step";
    subForm.appendChild(subBtn);
    subForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (addSub(item, subInput.value)) { save(); render(); }
    });
    main.appendChild(subForm);

    row.appendChild(main);

    var tools = el("div", "task-tools");
    var up = el("button", "task-move");
    up.type = "button";
    up.textContent = "\u2191";
    up.setAttribute("aria-label", "Move up");
    up.addEventListener("click", function () { if (moveItem(list, item.id, -1)) { save(); render(); } });
    tools.appendChild(up);

    var down = el("button", "task-move");
    down.type = "button";
    down.textContent = "\u2193";
    down.setAttribute("aria-label", "Move down");
    down.addEventListener("click", function () { if (moveItem(list, item.id, 1)) { save(); render(); } });
    tools.appendChild(down);

    var rm = el("button", "task-remove");
    rm.type = "button";
    rm.textContent = "\u00d7";
    rm.setAttribute("aria-label", "Remove task");
    rm.addEventListener("click", function () { removeItem(list, item.id); save(); render(); });
    tools.appendChild(rm);

    row.appendChild(tools);
    return row;
  }

  function renderActive() {
    var head = document.getElementById("active-name");
    var panel = document.getElementById("active-panel");
    var list = currentList();

    if (head) head.textContent = list ? list.name : "\u2014";
    if (panel) panel.hidden = !list;
    if (!list) {
      note("active-hint", state.lists.length ? "Pick a list above." : "Create your first list to begin \u2665");
      return;
    }

    var p = progress(list.items);
    var bar = document.getElementById("progress-fill");
    if (bar) bar.style.width = p.percent + "%";
    setText("progress-label", p.done + " of " + p.total + " done");

    var shown = filterItems(list.items, filter);
    var ul = document.getElementById("task-list");
    if (ul) {
      ul.textContent = "";
      if (!shown.length) {
        var empty = el("li", "task-empty");
        empty.textContent = filter === "all"
          ? "Nothing here yet \u2014 add the first little thing."
          : "Nothing in this view.";
        ul.appendChild(empty);
      } else {
        shown.forEach(function (item) { ul.appendChild(renderItem(list, item)); });
      }
    }
    note("active-hint", "");
  }

  function renderStats() {
    var t = totals(state);
    setText("stat-lists", t.lists);
    setText("stat-open", t.open);
    setText("stat-done", t.done);
  }

  function render() {
    renderListChips();
    renderActive();
    renderStats();
  }

  /* ---------------- events ---------------- */

  function wire() {
    var newListForm = document.getElementById("new-list-form");
    if (newListForm) {
      newListForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var input = document.getElementById("new-list-name");
        var name = input ? input.value : "";
        if (!clean(name)) { note("lists-note", "Give the list a name \u2665"); return; }
        var list = addList(state, name);
        if (input) input.value = "";
        activeListId = list.id;
        save();
        render();
        note("lists-note", "List created \u2014 add the first task.");
      });
    }

    var newTaskForm = document.getElementById("new-task-form");
    if (newTaskForm) {
      newTaskForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var list = currentList();
        if (!list) { note("task-note", "Pick or create a list first."); return; }
        var input = document.getElementById("new-task-text");
        var prio = document.getElementById("new-task-prio");
        var due = document.getElementById("new-task-due");
        var item = addItem(list, input ? input.value : "", prio ? prio.value : "med", due ? due.value : "");
        if (!item) { note("task-note", "Write the task first \u2665"); return; }
        if (input) input.value = "";
        if (due) due.value = "";
        save();
        render();
        note("task-note", "Added \u2665");
      });
    }

    var clearBtn = document.getElementById("clear-completed");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var list = currentList();
        if (!list) return;
        var removed = clearCompleted(list);
        save();
        render();
        note("task-note", removed ? "Cleared " + removed + " finished " + (removed === 1 ? "task" : "tasks") + "." : "Nothing to clear.");
      });
    }

    var delBtn = document.getElementById("delete-list");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        var list = currentList();
        if (!list) return;
        removeList(state, list.id);
        activeListId = state.lists.length ? state.lists[0].id : null;
        save();
        render();
      });
    }

    var filterRow = document.getElementById("filter-row");
    if (filterRow) {
      filterRow.addEventListener("click", function (ev) {
        var btn = ev.target.closest("button[data-filter]");
        if (!btn) return;
        filter = btn.getAttribute("data-filter");
        Array.prototype.forEach.call(filterRow.querySelectorAll("button"), function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        renderActive();
      });
    }
  }

  function boot() {
    load();
    var deep = null;
    try {
      if (typeof window !== "undefined" && window.location) {
        deep = new URLSearchParams(window.location.search).get("list");
      }
    } catch (e) { deep = null; }
    if (deep && findList(state, deep)) activeListId = deep;
    else if (state.lists.length) activeListId = state.lists[0].id;

    var dueInput = document.getElementById("new-task-due");
    if (dueInput) dueInput.value = "";
    render();
    wire();
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
