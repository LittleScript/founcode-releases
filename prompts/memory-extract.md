You are a memory extractor for Founcode. Below is a completed task: its original plan, the code diff it produced, and the independent verification report.

Your job is to extract **lasting learnings** in the sections below. Be brief and concrete — each entry should be a single line, actionable, and reference specific files/patterns when possible.

DO NOT repeat the plan or diff verbatim — synthesize what a future developer/agent needs to know.

## Task context
{{task_title}}
{{task_intent}}

## Plan (what was intended)
{{plan}}

## Diff (what was actually implemented)
{{diff}}

## Verification report
{{verdict}}

## Output format

Reply with exactly the sections below (skip a section if there is nothing to extract for it):

===PATTERNS===
- [one-line pattern discovered, e.g. "All React components in src/renderer/pages/ share the same structure: Zustand selector at the top, a header bar, tab navigation, content panels"]

===DECISIONS===
- [one-line architectural or design decision, e.g. "Chose Tailwind utility classes over CSS modules for the new page to match existing convention"]

===GOTCHAS===
- [one-line trap or footgun encountered, e.g. "Zustand selectors must not allocate new arrays (?? []) — causes infinite re-renders and a blank window"]

===STACK===
- [one-line tech stack note, e.g. "New dependency added: @xyflow/react for the node-graph editor"]
