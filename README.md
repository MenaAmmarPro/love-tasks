# Our Lists — love-tasks

Shared to-do lists for Mena and Ammar. The groceries, the plans, the tiny
promises — each list keeps its own pile of tasks with a priority, an optional
due date and little sub-steps. Everything is localStorage on this device only
(`mena-tasks`); nothing leaves the browser.

Live: https://menaammarpro.github.io/love-tasks/

## What's inside

- **Lists** — make as many as you like; each has its own progress bar.
- **Tasks** — text, priority (low / medium / high), optional due date.
- **Subtasks** — break a task into steps ("1 of 3 subtasks").
- **Reorder** — move a task up or down with the arrows.
- **Filter** — All / Active / Done, plus **Clear completed**.
- **Deep link** — `?list=<id>` opens straight to one list.

## Storage key

- `mena-tasks` — `{ lists: [{ id, name, items: [{ id, text, done, due, prio, subs: [{ id, text, done }] }] }] }`

## Namespace

`window.MenaTasks` exposes the pure logic (`progress`, `filterItems`,
`moveItem`, `clearCompleted`, `dueLabel`, `normalizeState`, …) so it can be
tested with the Node harness.

## Test

```sh
node --check js/app.js
node test/harness.js
```

Made with love, just for you ♥
