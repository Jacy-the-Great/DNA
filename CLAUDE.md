# DNA System — Claude Code Guide

This repo is Jacy's personal DNA context system: a single source of truth for the context files used across Claude Projects and other AI tools.

---

## How it works

Context is composed in layers using `@import` syntax. Each file imports its parent, so edits propagate automatically.

```
master.md
  primaries/professional.md    @../master.md
  primaries/personal.md        @../master.md
  primaries/landiq.md          @../master.md
    subs/professional/brand-manager.md   @../../primaries/professional.md
    subs/personal/martini.md             @../../primaries/personal.md  (+ override)
    subs/personal/real-estate.md         @../../master.md  (skips personal)
    subs/landiq/...                      @../../primaries/landiq.md
```

Two exceptions to standard inheritance:
- `martini.md` has a Tone Mirror override block at the top; dating comms rules replace the master Tone Mirror for that project.
- `real-estate.md` imports master.md directly, skipping the personal primary (health/lifestyle/dating context not needed).

Claude Projects cannot resolve `@imports`, so compiled flat files in `/outputs/` are what gets pasted into each Project.

---

## Core principle

Any fact that appears in more than one place lives in the lowest layer that covers all of its uses. Edit once, it updates everywhere.

---

## File structure

```
master.md               Identity, 6 Thrive priorities, behaviour rules, tone mirror
primaries/              Three context primaries, each importing master
subs/                   Project-specific subs, grouped by primary
  professional/
  personal/
  landiq/
outputs/                Compiled flat files — paste these into Claude Projects
scripts/
  compile.js            Flattens @import chains into outputs/
  audit.js              Checks the whole system for consistency
  new-sub.js            Scaffolds a new sub under a given primary
CLAUDE.md               This file
CHANGELOG.md            Version history
```

---

## What belongs where

| Content type | Layer |
|---|---|
| Core identity, Thrive priorities, universal behaviour rules, tone mirror | master.md |
| Professional role, target audience, hard constraints, evaluation standard | professional.md |
| Personal constraints, fears, co-pilot greeting | personal.md |
| Land iQ product, team, performance data, tools | landiq.md |
| Project-specific overrides or additions | relevant sub |

If a piece of content is ambiguous about which layer it belongs to, ask rather than guess. Layer placement is the whole point of the design.

---

## Scripts

**Compile all files:**
```
node scripts/compile.js
```

**Compile one file:**
```
node scripts/compile.js primaries/professional.md
```

**Run the audit:**
```
node scripts/audit.js
```

**Scaffold a new sub:**
```
node scripts/new-sub.js <primary> <sub-name>
# primary = professional | personal | landiq
# Example:
node scripts/new-sub.js landiq training-modules
```

---

## Maintenance

- Edit source files (master, primaries, subs), not the compiled outputs.
- After any edit, recompile the affected file and run the audit.
- Quarterly review: update the Thrive priorities in master.md and the performance data in landiq.md.
- Next scheduled review: 11 September 2026.
- After running audit.js, review the manifest sync flags. For any flagged file,
  manually re-attach it to the listed Claude Projects, then update last_synced
  in manifest.json to today's date.

---

## Known audit gaps (v2 improvements)

The audit does not currently detect duplicate facts across layers. The core design principle is that any fact appearing in more than one place should live only in the lowest layer that covers all its uses. Violations of this are currently a manual responsibility. A v2 audit check would diff content across layers and flag sentences or bullet points that appear in more than one file outside of the compiled outputs.
