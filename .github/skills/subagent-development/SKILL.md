---
name: subagent-development
description: 'Implement complex multi-step development tasks using subagent orchestration. Use when: breaking down a large plan into chunks; delegating implementation to specialized agents; implementing with built-in quality gates; coordinating implement→review→fix loops until approval.'
argument-hint: 'The development plan or task to implement'
---

# Subagent-Based Development Workflow

A structured approach to tackle complex development tasks by breaking them into manageable chunks and orchestrating subagents for implementation and review until quality gates pass.

## When to Use

- **Large, multi-step development tasks** that require careful coordination and tracking
- **Tasks requiring built-in quality gates** and review cycles
- **Complex refactors or implementations** where each step should be verified before proceeding
- **Work that benefits from delegation** to specialized subagents (implementer, reviewer, fixer)
- **Projects where audit trails of work progress matters** (track completion per chunk)

## Overview

The workflow uses subagent delegation with an implement→review→fix loop:

1. **Plan** — Break the task into logical chunks
2. **Track** — Create a work document to monitor progress
3. **Chunk Loop** — For each chunk:
   - **Implement** — Use Explore agent (or implementer) to build the chunk
   - **Mark in Progress** — Update work doc
   - **Review** — Use Explore agent (or reviewer) to validate quality
   - **Fix Loop** — While review finds issues:
     - Use Explore agent (or fixer) to address feedback
     - Re-review until approved
   - **Mark Complete** — Update work doc when review passes

## Procedure

### Step 1: Break Down the Plan

Start with the user's stated goal or plan. Analyze it and break it into **2–8 logical chunks**:
- Each chunk should be independently deliverable
- Each should take 10–30 minutes to implement
- Order chunks in dependency order (what depends on what)

**Output:** A bulleted list of chunks with brief descriptions and any dependencies.

### Step 2: Create a Work Document

Create a session memory file at `/memories/session/work.md` (or use the session memory tool) to track progress:

```markdown
# Work Plan: [Task Name]

## Status Summary
- [ ] Chunk 1: [Description]
- [ ] Chunk 2: [Description]
- [ ] Chunk 3: [Description]

## Chunks

### Chunk 1: [Description]
**Status:** Not Started → In Progress → Complete
**Notes:** (tracking notes as work progresses)

### Chunk 2: [Description]
**Status:** Not Started
**Notes:**

... (repeat for all chunks)
```

**Save immediately** so you can update it as you progress.

### Step 3: Implement Each Chunk

For each chunk in order:

#### 3a. Mark In-Progress
Update work doc: change status from "Not Started" → "In Progress"

#### 3b. Invoke Implement Subagent
Call the Explore subagent (or custom implementer agent) with:
- **Clear description of the chunk**
- **Context**: relevant files, architecture, acceptance criteria
- **Scope**: what should be delivered (file changes, tests, docs)

**Example prompt:**
```
Implement [Chunk Name]: [description]

Context:
- Related files: [paths]
- Acceptance criteria: [criteria]
- Style: Follow [conventions from this repo]

Return: Summary of changes made and files modified.
```

Wait for subagent to return implementation result.

#### 3c. Update Work Doc
Log what was implemented (file names, key changes) under the chunk's section.

### Step 4: Review Implementation (Loop Until Approved)

#### 4a. Invoke Review Subagent
Call the Explore subagent (or custom reviewer agent) with:
- **The implemented changes** (file paths, or description)
- **Review Criteria**:
  - Does it solve the stated problem?
  - Does it follow project conventions (from copilot-instructions, SKILL.md, code style)?
  - Are there tests? Are they passing?
  - Any bugs, edge cases, or missing error handling?

**Example prompt:**
```
Review the following implementation:

Changes:
- [file]: [brief description of what changed]

Criteria:
1. Solves the stated problem
2. Follows [project conventions]
3. Has appropriate tests
4. No obvious bugs or edge cases

Return: Approved / List of issues to fix (be specific)
```

Wait for subagent review result.

#### 4b. Review Passed?
- **Yes** → Move to Step 5 (Mark Complete)
- **No** → Proceed to Step 4c (Fix Loop)

#### 4c. Fix Loop (While Issues Remain)

**Repeat until review passes:**

1. **Invoke Fix Subagent** with review feedback:
   ```
   Fix the following issues in [Chunk Name]:
   
   Issues from review:
   - [Issue 1]: [description]
   - [Issue 2]: [description]
   
   Return: Files modified to address feedback
   ```

2. **Re-invoke Review Subagent** to verify fixes

3. **Loop back** to step 4b until "Approved"

### Step 5: Mark Complete

Update work doc: change status from "In Progress" → "Complete" (✓)

Add summary notes of what was built and any key decisions made.

### Step 6: Repeat for Next Chunk

Move to the next uncompleted chunk and return to Step 3.

### Step 7: Final Verification

Once all chunks are marked complete:
- Review the full work doc for completeness
- Do a final integration test (if applicable)
- Clean up session memory or archive work doc for future reference

## Key Patterns

### Communication with Subagents

- **Be specific**: Include file names, line numbers, and exact criteria
- **Return clear status**: Always ask subagent to summarize what was done/found
- **Single responsibility**: Each subagent call should have one clear goal (implement, review, or fix)

### Work Document Updates

- Update **before** and **after** each step so progress is visible
- Include notes about blockers, decisions, or context for later reference
- Use this as your audit trail

### Review Quality Gates

Don't move on until review gives explicit approval. This prevents cascading issues later.

## Example Session

```
User: "Implement the refactor plan for the API layer"
