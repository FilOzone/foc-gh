# Feature Specification: Enable Project Board Filtering with OR Conditions

**Feature Branch**: `007-project-board-or-filter`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: User description: "Support enriched query syntax on GitHub project boards — specifically OR conditions (GitHub issue #8)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standup View with OR Filter (Priority: P1)

A TPM navigates to a GitHub project board view (e.g., FilOzone projects/14) and enters a filter query containing OR syntax in the board's filter bar. For example: `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)`. The extension detects the OR syntax, splits the query into separate branches sharing the common prefix, executes multiple GitHub API queries, merges and deduplicates the results, and updates the board view with the combined result set. The TPM sees all items matching **any** of the OR branches without switching between multiple views.

**Why this priority**: This is the core use case — daily standups require seeing both open items and recently completed work in a single view. Without this, TPMs must manually switch between two board views, which disrupts standup flow and causes items to be missed.

**Independent Test**: Can be fully tested by entering an OR query on a project board and verifying the combined results appear. Delivers immediate standup productivity value.

**Acceptance Scenarios**:

1. **Given** a project board view is open with the extension active, **When** the user enters a filter query containing `(branch-1) OR (branch-2)` syntax, **Then** the board displays items matching either branch-1 or branch-2 (union), with shared prefix conditions applied to both branches.
2. **Given** a filter query with OR syntax that would return overlapping items from both branches, **When** the query executes, **Then** duplicate items appear only once in the results.
3. **Given** a filter query with a shared prefix and two OR branches, **When** the query executes, **Then** the shared prefix is applied to every branch (e.g., `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)` becomes two queries: `cycle:202605-2 biglep -status:"🎉 Done"` and `cycle:202605-2 biglep -last-updated:1days`).

---

### User Story 2 - Visual Feedback During OR Query Execution (Priority: P2)

While the extension is executing multiple API calls for an OR query, the TPM sees a visual indicator that work is in progress. Once all branches resolve, results appear together. If one branch fails, the user sees partial results along with a notification about the failed branch.

**Why this priority**: OR queries require multiple API calls, which may take longer than a single query. Without feedback, users may think the board is broken or attempt to re-enter the query.

**Independent Test**: Can be tested by entering an OR query on a board and observing loading state and error handling behavior.

**Acceptance Scenarios**:

1. **Given** an OR query is submitted, **When** the extension begins executing multiple API calls, **Then** the user sees a loading indicator distinct from GitHub's native loading state.
2. **Given** an OR query where one branch returns results and another fails (e.g., due to a rate limit), **When** results are displayed, **Then** the successful branch results are shown and a non-blocking notification explains which branch failed and why.

---

### User Story 3 - Graceful Fallback for Invalid OR Syntax (Priority: P3)

A user enters a malformed OR query (e.g., nested parentheses, OR inside parentheses, or trailing filter terms after the last group). The extension detects the syntax error, falls back to passing the raw query to GitHub's native filter, and shows a brief tooltip or notification explaining valid OR syntax.

**Why this priority**: Prevents confusion when users experiment with the syntax. Ensures the extension never blocks normal filtering, even on bad input.

**Independent Test**: Can be tested by entering various malformed OR queries and verifying fallback behavior.

**Acceptance Scenarios**:

1. **Given** a query with nested parentheses `((condition))`, **When** the extension parses the query, **Then** it falls back to native GitHub filtering and shows a syntax hint.
2. **Given** a query with filter terms after the final OR group, **When** the extension parses the query, **Then** it falls back to native GitHub filtering and shows a syntax hint.
3. **Given** a query without any OR syntax or parentheses, **When** the extension parses the query, **Then** it passes the query through to GitHub's native filter unchanged (full backward compatibility).

---

### Edge Cases

- What happens when an OR query returns zero results from all branches? The board should show an empty state consistent with GitHub's native "no items" message.
- What happens when one OR branch returns hundreds of items? The extension should handle pagination per branch and merge paginated results.
- What happens when the user modifies the filter query while a previous OR query is still in flight? The in-flight request should be cancelled and replaced by the new query.
- What happens when the user is rate-limited by GitHub's API mid-query? The extension should display partial results from completed branches and notify the user about the rate limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST detect OR syntax in the project board filter bar by recognizing the pattern: optional shared prefix followed by two or more parenthesized groups separated by the uppercase keyword `OR`.
- **FR-002**: The extension MUST split an OR query into its constituent branches, prepending the shared prefix to each branch.
- **FR-003**: The extension MUST execute one API query per OR branch and merge the results into a single deduplicated item set (deduplication by project item ID).
- **FR-004**: The extension MUST preserve the board's existing sort order and column layout when displaying merged OR results.
- **FR-005**: The extension MUST pass queries that do not contain OR syntax through to GitHub's native filtering unchanged (full backward compatibility).
- **FR-006**: The extension MUST reject invalid OR syntax (nested parentheses, OR inside parentheses, filter terms after the final group) and fall back to native filtering with a user-visible syntax hint.
- **FR-007**: The extension MUST show a loading indicator while OR branch queries are in flight.
- **FR-008**: The extension MUST handle partial failures gracefully — display results from successful branches and notify the user about failed branches.
- **FR-009**: The extension MUST cancel in-flight OR queries when the user changes the filter query before results return.
- **FR-010**: The extension MUST handle pagination within each OR branch so that large result sets are fully merged.

### Extension trust and data *(mandatory)*

- **EXT-001**: This feature reads project board item data (title, status, fields, assignees, labels, updated timestamps) via the GitHub GraphQL API using the user's existing authenticated token (PAT or OAuth). No new GitHub data categories are accessed beyond what the extension already reads for project board rendering. No data is written by this feature.
- **EXT-002**: No additional data is persisted locally by this feature. Merged query results are held in memory for display only and discarded on navigation or filter change.
- **EXT-003**: This feature does not introduce server-side storage of user tokens or data. All API calls go directly from the extension to `api.github.com` using the user's own credentials.
- **EXT-UI-001**: The loading indicator and syntax-hint notifications injected on `github.com` project board pages must use GitHub CSS custom properties (`--bgColor-*`, `--fgColor-*`, `--borderColor-*`) and follow Primer design patterns to maintain seamless integration in both light and dark modes, consistent with Principle VI of the constitution.

### Key Entities

- **OR Query**: A filter query string containing a shared prefix and two or more parenthesized branch conditions separated by the `OR` keyword. Parsed into a structured representation of prefix + branches.
- **Query Branch**: A single set of filter conditions extracted from an OR query. Each branch is an independent query that includes the shared prefix.
- **Merged Result Set**: The deduplicated union of project items returned by all OR branches, identified by project item ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A TPM can view both open items and recently completed items for a sprint in a single board view using one OR query, eliminating the need to switch between multiple views during standup.
- **SC-002**: OR query results appear within a reasonable time after submission, with a loading indicator visible during the wait.
- **SC-003**: Queries without OR syntax continue to work identically to before — zero regressions in native filtering behavior.
- **SC-004**: 100% of duplicate items across OR branches are eliminated in the merged result set.
- **SC-005**: Invalid OR syntax is detected and handled gracefully in all documented invalid patterns (nested parens, trailing terms, OR inside parens) — no silent failures or broken board states.

## Assumptions

- The user has the FOC GH extension installed and authenticated with a GitHub token that has project board read access (existing prerequisite — no new permissions needed).
- The GitHub ProjectV2 GraphQL API supports filtering via the same query syntax used in the project board filter bar. The extension can construct valid API queries from parsed OR branches.
- GitHub project board pages expose a DOM element or event that the extension can observe to detect filter query changes (the filter input bar).
- The extension operates on `github.com/orgs/*/projects/*/views/*` pages where project board views are rendered.
- OR queries will typically have 2-3 branches; supporting up to 5 branches covers all practical use cases per the tpm-utils OR syntax documentation.
- Rate limits from executing multiple API calls per OR query are manageable for typical usage (2-5 branches per query, infrequent re-queries).
