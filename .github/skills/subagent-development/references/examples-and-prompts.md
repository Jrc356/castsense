# Example Workflows & Prompts

This reference provides detailed examples and prompt templates for using the subagent-based development workflow.

## Example 1: Implementing a Feature with Tests

**Scenario**: User asks to implement a new API endpoint with full test coverage.

### Breakdown (Step 1)

```
Chunks:
1. Create route handler and API logic
2. Add unit tests for handler
3. Add integration tests
4. Update API documentation
5. Test error handling edge cases
```

### Work Doc (Step 2)

```markdown
# Work Plan: New API Endpoint

## Status Summary
- [ ] Route handler & logic
- [ ] Unit tests
- [ ] Integration tests
- [ ] API docs
- [ ] Error handling

## Details

### Chunk 1: Route Handler & Logic
**Status:** In Progress
**Description:** Create POST /api/users endpoint with validation
**Notes:** Using Express, validate email + phone, return user object

### Chunk 2: Unit Tests
**Status:** Not Started
...
```

### Implement (Step 3b)

**Prompt to subagent:**
```
Implement: Create POST /api/users endpoint

Context:
- File: backend/src/routes/users.ts
- Should accept { email, phone } JSON
- Validate email, require phone
- Return { userId, email, phone, created }
- Follow error handling in src/middleware/errors.ts

Acceptance Criteria:
1. Endpoint reachable at POST /api/users
2. Input validation with descriptive errors
3. Returns JSON with required fields

Return: List of files created/modified, key code snippets
```

### Review (Step 4a)

**Prompt to review subagent:**
```
Review the POST /api/users endpoint implementation

Changes in: backend/src/routes/users.ts

Criteria:
1. Correctly handles POST requests
2. Validates email format (RFC 5322 or similar)
3. Rejects requests without phone
4. Returns userId, email, phone, created fields
5. Error responses match ErrorEnvelope format from codebase
6. No hardcoded values or TODO comments
7. Follows project's TypeScript conventions (src/config/schema.ts pattern)

Return: "APPROVED" or "Issues: [list with file:line]"
```

### Fix Loop (Step 4c)

If review says: "Issues: missing UserId type definition"

**Prompt to fix subagent:**
```
Fix issues in POST /api/users implementation:

Issues:
1. UserId type missing: should be defined in types/user.ts alongside Email, Phone types

Return: Files modified with fixes, confirmation that types now defined
```

Then re-review.

---

## Example 2: Refactoring with Progressive Verification

**Scenario**: Large refactor of authentication layer into separate service.

### Breakdown (Step 1)

```
Chunks:
1. Create AuthService interface & types
2. Implement AuthService with existing logic
3. Update middleware to use AuthService
4. Update routes to use new flow
5. Migrate tests to new structure
6. Deprecate old auth utilities
```

### Implement Chunk 1 (Step 3b)

**Prompt:**
```
Implement: Define AuthService interface

Create file: backend/src/services/auth/types.ts

Interface should define:
- authenticate(user, pass): Promise<Session>
- validateToken(token): Promise<TokenPayload>
- refresh(token): Promise<TokenPair>
- logout(session): Promise<void>

Also define:
- Session type with userId, expiresAt
- TokenPayload type with userId, role
- AuthError enums for different failure modes

Return: File path and complete interface definitions
```

### Review Chunk 1 (Step 4a)

**Prompt:**
```
Review the AuthService interface definition

File: backend/src/services/auth/types.ts

Criteria:
1. All methods have clear Promise return types
2. Error cases documented (what exceptions can throw?)
3. Types are exported for use in other modules
4. Follows naming pattern from existing codebase (see Session, TokenPayload in src/types/auth.ts)
5. No unused types or imports

Return: APPROVED or Issues with specific line numbers
```

### Implement Chunk 2 (Step 3b)

After chunk 1 is approved, implement the actual service:

**Prompt:**
```
Implement: AuthService implementation

File: backend/src/services/auth/service.ts

Implement interface from types.ts:
- Move existing verify logic from src/middleware/auth.ts
- Implement TokenPair rotation in refresh()
- Include password hashing with bcrypt (copy pattern from existing code)

Acceptance Criteria:
1. All interface methods implemented
2. Uses bcrypt for password (consistent with existing)
3. Errors throw AuthError types from types.ts
4. No console.log, use logger from config/logger

Return: Full implementation, note any dependencies added
```

---

## Example 3: Multi-Service Features

**Scenario**: Add real-time notifications across backend + mobile.

### Breakdown

```
Chunks:
1. Backend: Add WebSocket server setup
2. Backend: Create Notification service
3. Backend: Add notification routes
4. Backend: Tests for notification service + routes
5. Mobile: Add notification listener hook
6. Mobile: Display notification UI
7. Mobile: Tests
```

### Work Doc Pattern

Notice how backend chunks complete first (dependency), then mobile:

```markdown
## Status
- [x] WebSocket server setup
- [x] Notification service
- [x] Notification routes
- [x] Backend tests
- [ ] Mobile listener hook
- [ ] Mobile UI
- [ ] Mobile tests
```

### Implement/Review Loop for Each

Follow the same Step 3 → Step 4 → Step 5 pattern for each chunk.

---

## Subagent Scope Tips

### For Implementation Subagent

Ask it to:
- Look at similar code in the repo (provide examples)
- Follow naming + style conventions
- Include error handling
- Report back with file list and key snippets

### For Review Subagent

Ask it to:
- Check against specific files/patterns (e.g., "compare to src/services/user.ts")
- Verify test coverage (ask if tests exist and pass)
- Look for edge cases specific to domain
- Flag any missing type definitions or imports

### For Fix Subagent

Ask it to:
- Address **only** the reported issues (don't refactor beyond that)
- Quote the problem and the fix
- Flag if fix requires tests to be updated too

---

## Prompt Template Library

### Generic Implement

```
Implement: [Chunk Name]

Context:
- File(s): [paths]
- Related patterns: [reference files to follow]
- Constraints: [no external deps, use existing utils, etc]

Acceptance Criteria:
- [criterion 1]
- [criterion 2]
- [criterion 3]

Return: File list, code snippets showing key changes
```

### Generic Review

```
Review: [Chunk Name] implementation

Files: [list changed files]

Criteria:
- [criterion 1]
- [criterion 2]
- [criterion 3]

Return: APPROVED or Issues (file:line with description)
```

### Generic Fix

```
Fix issues in [Chunk Name]:

Issues to address:
- [issue 1 with context]
- [issue 2 with context]

Return: Files modified, summary of changes made
```

---

## Work Doc Template

Use this as a starting point:

```markdown
# Work Plan: [Feature/Refactor Name]

Started: [date]
Goal: [what we're building]

## Progress Snapshot

- [ ] Chunk 1: [name]
- [ ] Chunk 2: [name]
- [ ] Chunk 3: [name]

## Chunk Details

### Chunk 1: [Name]
**Status:** Not Started / In Progress / Complete
**Related files:** [paths]
**Dependencies:** [other chunks it depends on]
**Implementation notes:** [notes from Step 3c]
**Review feedback:** [notes from Step 4a/4c]
**Completion date:** [if complete]

### Chunk 2: [Name]
...

## Integration Notes

[Any cross-chunk notes, gotchas, or final validation steps]
```

---

## Common Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| Chunk too big, takes too long | Break it into 2–3 smaller chunks with narrower scope |
| Review finds many issues | Issues means the spec wasn't clear; refine acceptance criteria before re-implementing |
| Subagent doesn't understand context | Provide example code or file paths it should follow |
| Work doc gets out of sync | Update it **immediately** after each step, not at the end |
| Fix loop never ends | Enforce "address only reported issues" in fix prompt; don't let fixer go off-road |
