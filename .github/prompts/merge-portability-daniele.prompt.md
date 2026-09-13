---
description: "Compare two branch versions of the same project, build a choose/keep/drop merge table, and validate each accepted change with pre/post checks"
mode: "agent"
tools: ["run_in_terminal", "read_file", "grep_search", "file_search", "get_errors"]
---

Compare and merge two project versions safely, without losing work, while preserving the integrity of the final application.

## Context

Base project on my machine (Lucas):
- repository folder: `C:\VSC_Live_Server_LucasBerry`
- Git branch: `portability-stabilization`

Collaborator project on Daniele's machine:
- repository folder: `C:\VSC_Live_Server_DanielWest`
- Git branch: `daniele-local`

Final destination of the unified project:
- repository folder: `C:\VSC_Live_Server_Merge`
- final branch / working branch: use this folder as the unique final repository for the merged result

This is a same-codebase comparison across two local copies and two Git branches. Goal: create one final version that keeps the best and safest parts from both, while preserving the existing working behavior of the original branch.

## Required behavior

1. Start from the current branch on the Lucas repo as the canonical base.
2. Compare the two repositories and identify only the real differences, excluding generated/cache/temp files.
3. Produce a comparison table with these columns:
   - File / area
   - Lucas version
   - Daniele version
   - Difference summary
   - Functional intent
   - Short explanation (brief description of what the change does and why it matters)
   - Risk level (low / medium / high)
   - Recommendation (keep / discard / partial / integrate with safeguard)
   - Reasoning
   - Validation required

   The short explanation must be written in plain language so the user can understand in one glance what the change does and whether it is useful or risky. For example: "improves the mobile layout and PDF startup flow, but changes the same DOM logic used by the main page; keep only if the behavior remains stable after testing." This helps decide what to keep and what to discard.
4. For each proposed integration, do not blindly merge anything. Evaluate whether the change could break the application or cause a crash; prefer minimal, guarded, reversible changes.
5. Before accepting a change, run the smallest possible validation test or sanity check to understand the current behavior, then run the same validation again after the merge.
6. Never choose a change only because it is newer; choose it only if it is safe, minimal, and functionally useful.
7. If a difference is ambiguous, explain the tradeoff and recommend the safer option.
8. Keep the final result as a single clean, working version of the project.

## Comparison scope

Focus on real code and project differences, especially:
- HTML pages and UI behavior
- JavaScript logic and rendering scripts
- CSV/data loading and processing
- Firebase or hosting config
- server startup/shutdown scripts
- security-related or environment-specific settings
- startup UX and page navigation
- any custom functions, helpers, or automation

Ignore or explicitly label as non-relevant:
- editor metadata
- local environment files
- generated caches
- temporary artifacts
- OS-specific noise not affecting runtime

## Required output format

Return a clear structured result with:

### 1) Merge plan summary
- target branch to preserve as base
- branch to merge from
- working branch to use for integration
- safety rule

### 2) Difference table
Use this exact structure:

| File / Area | Lucas version | Daniele version | Difference summary | Functionality | Short explanation | Risk | Recommendation | Reasoning | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Keep the table limited to actual differences only. Do not include identical files.

For each row, the short explanation should answer: "What is the change, what problem does it solve, and is it likely to be safe?" This lets the user decide quickly whether to keep it, reject it, or merge only part of it.

### 3) Step-by-step merge recommendation
For each accepted change:
1. explain why it should be kept or adapted
2. indicate exact file(s) involved
3. specify if it must be merged, partially merged, or skipped
4. specify the safe validation to run before and after

### 4) Final merge strategy
Give a practical order of execution:
1. stabilise the base branch
2. integrate low-risk differences first
3. validate after each change
4. merge medium-risk changes only after testing
5. keep high-risk changes isolated or reject them
6. finally merge the accepted result into the unified destination repository at `C:\VSC_Live_Server_Merge`

### 5) Validation checklist
State exact commands or manual checks to run before and after, such as:
- start local web server
- open the main dashboard / landing page
- verify that CSV data loads correctly
- verify no JS console errors
- verify fullscreen/scroll behavior if affected
- verify Firebase deployment flow if relevant
- validate that the app still loads and functions as before the change

## Safety rules

- Always validate before and after every accepted modification.
- Do not merge large blocks of code without understanding their purpose.
- Prefer surgical, file-level merging over copying whole directories.
- If a change introduces instability, reject it or isolate it behind a guard.
- Keep a working backup branch before the merge begins.
- Preserve the original and functional behavior of the Lucas base branch unless a Daniele change clearly improves it without risk.

## Decision logic

When evaluating each difference, choose in this order:
1. Keep the change if it improves functionality and has low risk.
2. Integrate partially if the change is useful but needs adaptation.
3. Reject it if it is redundant, unstable, or introduces project-wide risk.
4. Keep both variants only if they are complementary and can coexist without conflict.

## Practical selection guidance

Use this simple rule for each difference:
- Keep it if it improves user-visible behavior, does not conflict with the base app, and passes the validation checks.
- Reject it if it is redundant, unstable, or changes critical logic without a clear benefit.
- Integrate it partially if the idea is good but the original implementation touches several files or risky flows.
- Keep both only if they are clearly complementary and do not overlap in execution paths.

In other words: prefer a small, stable, working improvement over a larger, riskier change that looks fancy but may compromise the whole project.

## Final requirement

Deliver a final recommendation that is explicit, documented, and safe: one single version, resulting from the best combination of the two branches, but with quality, stability, and non-breaking behavior prioritized above all else.

## Execution plan

1. Verify which repo is the canonical base branch.
2. Compare Git branches and names of changed files.
3. Identify functional differences and risk areas.
4. Produce the difference table with only real deltas.
5. For each high-impact file, inspect the exact logic and recommended action.
6. Merge only the accepted, low-risk modifications to the Lucas repo working branch.
7. Run before/after validation on each integration.
8. Document the final merged state and list what was intentionally rejected.

## Optional reminder for the agent

If the comparison reveals a conflict or a risky area, do not force a merge. Explain the issue, propose the safest alternative, and wait for approval before applying it.
