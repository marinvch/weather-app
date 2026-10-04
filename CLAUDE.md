@AGENTS.md

## Verifying your work

| Check | Command | A healthy run |
|---|---|---|
| Build | `npm run build` | exits 0 and ends `✓ built in …`; the "chunks larger than 500 kB" warning on `index-*.js` (~700 kB: MUI, Emotion, the map, the shell) is known and is not a failure |
| Test | `npm run test:run` | every test passes; none skipped to get there (37 files, 643 tests on `dev` after the 2026-09-27 robustness pass) |
| Lint | `npm run lint` | no output, exit 0 |
| Typecheck | `npm run typecheck` | no output, exit 0 |

Use `npm run test:run`, not `npm test`: `npm test` is `vitest` in watch mode and does not return in
an interactive terminal.

"Done" means these ran and passed in this session, with their output shown — not that the edit
was made. A red test is information about the code; change the code until it is green, and leave
the test alone unless the task is explicitly to change what it asserts.

## Working as a team

This repo has single-job agents in `.claude/agents/`: `architect`, `implementer`, `tester`, `project-manager`, `verifier` (reviewer). This session runs them.
Before any work on a new task that changes code:

1. Run `/cortex-impact --size` on the files the task will touch, and tell the developer what it
   recommends, in words (single, team, or that it cannot size the task), and why.
2. Then end your reply with the exact question "Single agent or team?" and stop: plan, edit and
   delegate nothing until they answer. The developer decides, even on a single recommendation or
   a request to just do it. Never say you asked unless that question is in your reply.
3. On "single", work as usual. On "team", load the `team` skill and follow it: a plan, at most two
   rounds of cited objections, then a failing test, the change and an independent review.

To stop using the team, delete this section, `.claude/skills/team/` and the agents.
