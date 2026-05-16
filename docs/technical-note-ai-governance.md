# Technical note: AI action transparency, audit attribution, and overrides

**Work order:** WO #11 — Build AI Action Transparency & Override Framework  
**Applies to:** cohort-14 back end and front end (cross-cutting governance for all AI features).

## Policy

- **Universal access:** AI capabilities must not be gated behind a separate license tier, add-on, or “upgrade to unlock” UX. Use the same authentication and role checks as the surrounding feature (e.g. desk operations remain `agent` / `admin` where appropriate).
- **Transparency:** Actions performed by AI must be distinguishable from human actions in the ticket audit trail.
- **Override:** Authorized users must be able to correct AI-influenced outcomes; each override is recorded in the audit trail and attributed to the human who performed it.

## Database and audit model

- Migration **`007_ai_audit.sql`** extends `audit_entries` with:
  - `actor_kind` — `human` (default) or `ai_system`
  - `ai_confidence` — optional `REAL` (typically 0–1)
  - `ai_feature` — optional string (e.g. `classification`, `routing`)
- A fixed **`users`** row identifies the AI principal for foreign-key integrity:
  - **ID:** `00000000-0000-4000-8000-000000000001`
  - **Email:** `ai-system@platform.internal`
- Constants: `src/constants/systemUsers.js` (`SYSTEM_AI_USER_ID`).

## Recording audits from code

- **`audit()`** in `src/services/auditContext.js` accepts optional `actorKind`, `aiConfidence`, and `aiFeature`. When `actorKind` is `ai_system`, the writer forces `actorId` to `SYSTEM_AI_USER_ID`.
- **`auditAiAction()`** is the preferred entry point for future AI feature services: it sets AI metadata and always attributes the row to the platform AI user.

Do not invent ad hoc actor IDs for “the AI” in application code.

## GraphQL

- **`AuditEntry`** includes `actorKind` (`HUMAN` | `AI_SYSTEM`), `aiConfidence`, and `aiFeature`. Human rows resolve `actorName` from the `users` join; AI rows surface **`actorName` “AI system”** for display consistency.
- **`overrideTicketAiAction(input: OverrideTicketAiInput!)`** — Agents and admins apply human corrections over fields that AI may influence: **`CATEGORY`**, **`PRIORITY`**, **`ASSIGNMENT`**. It performs the domain update, then appends an audit row with action **`ai_action_overridden`**. Optional **`supersedesAuditEntryId`** must reference an existing **`ai_system`** audit row for the same ticket (validation in resolver).

## Front end

- **`AuditLogView`** shows an AI badge, optional feature label, and confidence when `actorKind === AI_SYSTEM`.
- **`AiSuggestionPanel`** is the reusable shell for inline AI output (content, confidence, override control). Ticket detail composes it for desk roles as a non-blocking placeholder until individual AI features supply real suggestions.

## Related files (non-exhaustive)

| Area        | Location |
|------------|----------|
| Audit write | `src/services/auditContext.js` |
| Resolvers  | `src/graphql/ticketResolvers.js` (`mapAuditEntry`, `overrideTicketAiAction`) |
| Schema     | `src/graphql/schema.js` |
| Client ops | `frontend/src/graphql/audit.js`, `frontend/src/graphql/tickets.js` (`OVERRIDE_TICKET_AI`) |
| UI         | `frontend/src/components/AuditLogView.jsx`, `frontend/src/components/AiSuggestionPanel.jsx` |

When adding a new AI capability (classification, summarization, virtual agent, etc.), call **`auditAiAction()`** for AI-originated mutations and surface suggestions through **`AiSuggestionPanel`** (or equivalent) with **`overrideTicketAiAction`** wired to the relevant field.
