---
name: loop-workflow
description: >-
  Iteratively build a feature or project in a loop: plan, implement, then verify
  with lightweight gates (tsc --noEmit, lint, build), repeating until every gate
  passes. Splits large tasks across parallel sub-agents only when there are 3+
  independent workstreams. Use when the user asks to build, iterate, or "loop"
  on a project, or wants an autonomous plan -> implement -> verify cycle.
---

# Loop Workflow

Build work in a tight **plan -> implement -> verify** loop and keep iterating
until the verification gates pass. This is a general-purpose workflow with
defaults tuned for this repo (Next.js 14 App Router + TypeScript + Supabase).

There is **no automated test framework** in this project, and **no deployment
step** in this workflow. Verification is done with lightweight gates, and a
clean production build is the finish line — never push or deploy.

## The loop

Copy this checklist and track progress:

```
Loop Progress:
- [ ] 1. Plan the work
- [ ] 2. Implement
- [ ] 3. Verify gates (tsc + lint + build)
- [ ] 4. Gates pass? -> done. Gates fail? -> fix and re-run step 3.
```

**Step 1 — Plan.** Restate the goal, list the concrete changes, and identify
file/feature boundaries. For a large task, decide here whether to parallelize
(see "Parallel sub-agents" below).

**Step 2 — Implement.** Write the code directly (code-first, not test-first).
Keep changes scoped to the plan.

**Step 3 — Verify gates.** Run all three from the repo root. They must **all**
pass:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

**Step 4 — Loop or stop.** If any gate fails, read the error, fix it, and re-run
the gates. Only stop once all three pass. Then report what changed. **Do not
deploy** — preparing a clean build is the end of the loop.

## Verification gates


| Gate  | Command            | Checks                             |
| ----- | ------------------ | ---------------------------------- |
| Types | `npx tsc --noEmit` | TypeScript compiles with no errors |
| Lint  | `npm run lint`     | ESLint (`next lint`) is clean      |
| Build | `npm run build`    | `next build` succeeds              |


Fix every error before considering the loop complete. Treat new warnings you
introduced as failures too; pre-existing warnings can be left unless they block
the build.

## Parallel sub-agents

Only spin up parallel sub-agents for a **large task with 3+ clearly independent
workstreams**. For anything smaller, do the work directly — coordination
overhead is not worth it.

When you do parallelize:

- Split work along **non-overlapping file/feature boundaries** so two agents
never edit the same file.
- Give each sub-agent a self-contained task description (it does not see this
conversation) and the exact files it owns.
- The **parent reviews and merges** each result, then runs the verification
gates once on the combined result.

```
Parallel checklist:
- [ ] Confirm 3+ independent workstreams with disjoint files
- [ ] Assign each sub-agent its own files/feature
- [ ] Launch sub-agents
- [ ] Parent reviews + integrates each result
- [ ] Parent runs the verification gates on the merged result
```

If the workstreams turn out to overlap, collapse them and do the work
sequentially instead.