# Global boards in the Projects picker — status

**Last updated:** 2026-03

## Current behavior

When visibility rules in options apply (see the **Global board URLs** and **Repos to proactively check…** hints on the extension options page), opening GitHub’s **Projects** picker on an issue or pull request may show a **Global boards** block. That block currently displays a **Coming soon** message only.

## Not implemented yet

- Listing configured global boards with checkboxes (or equivalent) inside the picker.
- **Adding** or **removing** the current issue/PR on those boards via the picker, including keeping that state in sync with GitHub’s native project rows.
- Relying on this picker as a substitute for using the organization project on [github.com](https://github.com) or the **FOC sidebar** on repos you configure for proactive membership checks.

## What still works

- **FOC sidebar card** on configured repos (primary board, field editing where supported).
- **Global board URLs** and **target repos** settings in options (wording describes intended behavior for when picker support lands).

Work tracked under spec **006** in [`specs/006-outside-org-projects-picker/`](../specs/006-outside-org-projects-picker/).
