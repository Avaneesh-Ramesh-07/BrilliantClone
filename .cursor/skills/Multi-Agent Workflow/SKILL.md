# Skill: Multi-Agent Workflow

**Environment:** Cursor Agent Mode **Scheduling:** Parallel when safe, sequential when dependencies exist **Orchestration:** Lead agent spawns and manages sub-agents

---

## When to Use This Skill

Use this skill when a task meets one or more of the following criteria:

- The task has **clearly separable concerns** that do not share files (e.g. build the database schema AND build the UI components — they don't touch the same files until integration)
- The task requires **independent research or analysis** before implementation (e.g. read 3 different parts of the codebase to understand a system before modifying it)
- The task has a **natural pipeline** where the output of one step is the input of the next (e.g. design the API → implement the API → write tests for the API)
- A single-agent approach would require **holding too much context at once**, risking errors from context window saturation
- The task involves **multiple files or modules** where changes in one could invalidate changes in another if done simultaneously

Do NOT use this skill for:

- Simple single-file edits
- Tasks where the correct implementation cannot be known until the first step is complete
- Tasks where all steps touch the same file (serialise these instead)

---

## Roles

### Lead Agent

The Lead Agent is the orchestrator. It is the agent that reads this skill and the user's task. It never directly implements code. Its responsibilities are:

1. **Decompose** the task into sub-tasks
2. **Identify dependencies** between sub-tasks
3. **Assign** sub-tasks to Sub-Agents with complete, self-contained instructions
4. **Gate** each Sub-Agent from starting until its dependencies are resolved
5. **Review** each Sub-Agent's output before allowing downstream agents to proceed
6. **Integrate** Sub-Agent outputs if a final merge step is needed
7. **Verify** the completed task against the original requirements

The Lead Agent writes a **task plan** (see Section: Task Plan Format) before spawning any Sub-Agent. The plan is written to a scratch file at `.cursor/agent-plan.md` so it persists across agent turns.

### Sub-Agent

A Sub-Agent is spawned by the Lead Agent for exactly one sub-task. Each Sub-Agent:

- Receives a **self-contained instruction** — it does not need to read the task plan or communicate with other Sub-Agents
- Knows **exactly which files it may read and which files it may write** — it must not touch files outside its assigned scope
- Reports its output in a **structured completion note** appended to `.cursor/agent-plan.md`
- Halts and reports to the Lead Agent if it encounters an ambiguity it cannot resolve alone

---

## Task Plan Format

Before spawning any Sub-Agent, the Lead Agent writes `.cursor/agent-plan.md` using this structure:

```markdown
# Agent Plan: [Task Name]
Generated: [timestamp]
Status: IN PROGRESS

## Task Summary
[1–3 sentence description of what the full task accomplishes]

## Dependency Graph
[Text-based DAG showing which sub-tasks depend on which]
Example:
  SubTask-A ──┐
              ├──► SubTask-C ──► SubTask-D
  SubTask-B ──┘

## Sub-Tasks

### SubTask-A
Status: [ ] Pending | [ ] In Progress | [x] Complete | [ ] Blocked
Assignee: Sub-Agent-1
Files MAY READ: [list every file this agent needs to read]
Files MAY WRITE: [list every file this agent may create or modify]
Files MUST NOT TOUCH: [list files that conflict with other sub-tasks]
Dependencies: None
Instruction:
  [Complete self-contained instruction the Sub-Agent will execute.
   Written as if the Sub-Agent has no other context.
   Includes: what to build, exact file paths, interfaces it must conform to,
   any constants or types it must use, and what "done" looks like.]
Completion Note: [filled in by Sub-Agent when done]

### SubTask-B
Status: [ ] Pending
...

### SubTask-C
Status: [ ] Pending
Dependencies: SubTask-A, SubTask-B
...

```

---

## Conflict Prevention Rules

These rules are mandatory. A Sub-Agent that would violate any rule must stop and report to the Lead Agent instead.

### Rule 1 — No two Sub-Agents write the same file simultaneously

Before assigning a file to a Sub-Agent, the Lead Agent checks whether any currently-running or pending Sub-Agent has that file in its MAY WRITE list. If yes, the second sub-task is placed in the sequential queue — it may not start until the first Sub-Agent completes and its output is reviewed.

### Rule 2 — Shared interfaces are defined before implementation begins

If two or more Sub-Agents need to call each other's output (e.g. Sub-Agent-A builds an API that Sub-Agent-B will call), the Lead Agent defines the interface (function signatures, type definitions, API contract) in a shared file BEFORE spawning either Sub-Agent. Both Sub-Agents receive the interface definition in their instructions. Neither Sub-Agent modifies the interface — only the Lead Agent may do that, and only between Sub-Agent runs.

### Rule 3 — Sub-Agents are read-only on files outside their scope

A Sub-Agent may READ any file in the codebase to understand context. It may only WRITE files explicitly listed in its MAY WRITE list. If a Sub-Agent discovers it needs to write a file not in its list, it stops and reports this to the Lead Agent.

### Rule 4 — Review before unblocking

The Lead Agent reviews each Sub-Agent's output before marking it Complete and unblocking dependent Sub-Agents. The review checks:

- Did the Sub-Agent write only files in its MAY WRITE list?
- Does the output conform to any shared interface?
- Does the TypeScript / code compile without errors in the affected files?
- Are there any side effects that could affect downstream Sub-Agents?

### Rule 5 — Failing Sub-Agent blocks its dependents

If a Sub-Agent's output fails the review, its status is set to BLOCKED. All Sub-Tasks that depend on it are also blocked. The Lead Agent either re-runs the Sub-Agent with corrected instructions or handles the failure itself before unblocking.

---

## Scheduling Logic

```
FOR EACH sub-task in the plan:
  IF sub-task has no dependencies:
    → Eligible for parallel execution
  IF all of sub-task's dependencies have status = Complete AND reviewed:
    → Eligible for parallel execution
  IF any dependency has status = Pending, In Progress, or Blocked:
    → Hold. Do not start.

Parallel execution = the Lead Agent spawns multiple Sub-Agents in the same
Cursor Agent turn by issuing multiple distinct sub-task instructions.

Sequential execution = the Lead Agent issues one sub-task instruction,
waits for completion and review, then issues the next.

```

**Practical limit:** Do not spawn more than 3 Sub-Agents in parallel in a single Cursor Agent turn. Beyond 3, the context becomes difficult to track and review quality degrades.

---

## Step-by-Step Execution Protocol

### Step 0 — Read and understand the full task

Before writing the plan, the Lead Agent reads:

- The user's task description
- Any PRD, spec, or context documents referenced
- The relevant parts of the existing codebase (file tree, key files)

The Lead Agent does NOT start implementing anything in Step 0.

### Step 1 — Write the task plan

Write `.cursor/agent-plan.md` with the full dependency graph and all sub-task definitions. Include complete instructions for every sub-task even if they won't run until later. Shared interfaces are written to their target files now (as stubs or type definitions only — not implementations).

Present the plan to the user with: "Here is my agent plan. Review it and say 'proceed' to begin execution, or give me corrections."

**Wait for user confirmation before Step 2.**

### Step 2 — Execute parallel-eligible sub-tasks

Spawn Sub-Agents for all sub-tasks with no unresolved dependencies. Each Sub-Agent receives only its own instruction — not the full plan.

### Step 3 — Review completed sub-tasks

For each completed Sub-Agent:

- Update its status in `.cursor/agent-plan.md`
- Run the review checklist (Rule 4)
- If review fails: set status BLOCKED, document the issue, decide whether to re-run or fix directly
- If review passes: set status Complete

### Step 4 — Unblock and continue

Check the dependency graph. Any sub-task whose dependencies are all Complete is now eligible. Return to Step 2.

### Step 5 — Integration

When all sub-tasks are Complete, the Lead Agent performs integration:

- Imports and wires together the outputs of Sub-Agents if needed
- Runs the full project TypeScript check: `npx tsc --noEmit`
- Runs any existing tests
- Fixes any integration errors directly (does not spawn a new Sub-Agent for small fixes)

### Step 6 — Final verification

The Lead Agent verifies the completed work against the original task requirements line by line. Updates `.cursor/agent-plan.md` with `Status: COMPLETE`. Reports to the user with a summary of what was built, which files were created or modified, and any known limitations.

---

## Sub-Agent Instruction Template

When the Lead Agent spawns a Sub-Agent, it must provide an instruction in this exact format. Do not abbreviate any section.

```
## Sub-Agent Instruction: [SubTask Name]

### Your Role
You are a Sub-Agent executing one specific sub-task. You do not need to know
about other sub-tasks. Execute only what is described here.

### Task
[Exact description of what to build or change. Be specific about behavior,
not just structure. Include acceptance criteria.]

### Files You May Read (for context only)
- [file path] — [why you need to read it]

### Files You May Write (your output scope)
- [file path] — [what you will write here]

### Files You Must NOT Touch
- [file path] — [reason: being modified by another agent / must not change]

### Interfaces and Types You Must Conform To
[Paste the exact TypeScript interfaces, function signatures, or API contracts
that your output must satisfy. Do not change these.]

### Definition of Done
- [ ] [specific verifiable condition]
- [ ] [specific verifiable condition]
- [ ] TypeScript compiles in your affected files with no errors

### When You Are Done
Append the following to `.cursor/agent-plan.md` under your sub-task's
Completion Note section:
  - Files created: [list]
  - Files modified: [list]
  - Key decisions made: [any non-obvious choices and why]
  - Potential issues for Lead Agent to review: [anything uncertain]

```

---

## Example: Applying This Skill to a Real Task

**User task:** "Add a coin economy to my app. Users earn coins for correct answers. Coins are stored in Supabase. A coin counter shows in the header."

**Lead Agent decomposition:**

```
SubTask-A: Create Supabase table and types
  Files MAY WRITE: supabase/migrations/add_game_state.sql, types/game.ts
  Dependencies: None

SubTask-B: Build awardCoins() utility function
  Files MAY WRITE: lib/coins.ts
  Files MAY READ: types/game.ts (from SubTask-A output)
  Dependencies: SubTask-A (needs the GameState type)

SubTask-C: Build CoinCounter component
  Files MAY WRITE: components/ui/CoinCounter.tsx
  Files MAY READ: types/game.ts
  Dependencies: SubTask-A (needs the type)
  [Can run in parallel with SubTask-B]

SubTask-D: Integrate awardCoins into step player, add CoinCounter to header
  Files MAY WRITE: components/lesson/StepPlayer.tsx, app/layout.tsx
  Files MAY READ: lib/coins.ts, components/ui/CoinCounter.tsx
  Dependencies: SubTask-B, SubTask-C (needs both to exist first)

```

Dependency graph:

```
SubTask-A ──► SubTask-B ──┐
          └──► SubTask-C ──┴──► SubTask-D

```

SubTask-B and SubTask-C run in parallel after SubTask-A completes. SubTask-D runs only after both B and C pass review.

---

## What to Do When Things Go Wrong


| Situation                                                              | Action                                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Sub-Agent writes a file outside its scope                              | Revert the out-of-scope change. Re-issue instruction with explicit prohibition.                       |
| Sub-Agent output does not conform to shared interface                  | Set status BLOCKED. Fix the interface mismatch directly or re-run Sub-Agent with corrected interface. |
| Two Sub-Agents produce conflicting implementations of the same concept | Stop both. Define the correct approach in the plan. Re-run whichever is downstream.                   |
| TypeScript errors after integration                                    | Fix directly as Lead Agent — do not spawn a new Sub-Agent for small fixes.                            |
| Sub-Agent halts and reports ambiguity                                  | Resolve the ambiguity in the plan, update the Sub-Agent's instruction, re-run.                        |
| Task turns out to be simpler than planned                              | Collapse remaining sub-tasks and execute directly as Lead Agent without spawning further Sub-Agents.  |


---

## Files This Skill Creates


| File                    | Purpose                                      | Deleted after task?   |
| ----------------------- | -------------------------------------------- | --------------------- |
| `.cursor/agent-plan.md` | Task plan, dependency graph, sub-task status | No — keep as a record |


---

## Correctness Over Efficiency

When there is any doubt about whether two sub-tasks conflict, default to sequential execution. The cost of a conflict (broken code, merge effort, wasted Sub-Agent work) is always higher than the cost of waiting one extra turn. Parallelise only when the independence of sub-tasks is certain.