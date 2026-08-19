import { parseGithubIssuePrPath } from './github-url.js'

/**
 * GitHub's own document.title suffix for issue/PR pages, e.g.:
 *   "{title} · Issue #10 · owner/repo"
 *   "{title} by {author} · Pull Request #508 · owner/repo"
 * Captures the bare title in group 1.
 */
const GITHUB_TITLE_SUFFIX_RE = /^(.*?)(?:\s+by\s+[^\s·]+)?\s*·\s*(?:Issue|Pull Request)\s+#\d+\s*·.*$/i

export function stripGithubTitleSuffix(rawTitle: string): string {
  const m = rawTitle.match(GITHUB_TITLE_SUFFIX_RE)
  return (m ? m[1] : rawTitle).trim()
}

/**
 * Build the link text for the given page. On a github.com issue/PR page,
 * strips GitHub's title suffix and appends `(owner/repo#number)` per
 * https://github.com/FilOzone/foc-gh/issues/10.
 */
export function buildLinkTitle(rawTitle: string, url: string): string {
  const title = rawTitle.trim()

  try {
    const u = new URL(url)
    if (u.hostname === 'github.com') {
      const ctx = parseGithubIssuePrPath(u.pathname)
      if (ctx) {
        return `${stripGithubTitleSuffix(rawTitle)} (${ctx.owner}/${ctx.name}#${ctx.number})`
      }
    }
  } catch {
    /* not a valid URL; fall back to the raw title */
  }

  return title
}

/** `[title](url)` — used as the `text/plain` clipboard fallback. */
export function buildMarkdownLink(rawTitle: string, url: string): string {
  return `[${buildLinkTitle(rawTitle, url)}](${url})`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `<a href="url">title</a>` — the primary `text/html` clipboard entry, so pasting into rich-text targets (e.g. Google Docs) yields a real hyperlink. */
export function buildHtmlLink(rawTitle: string, url: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(buildLinkTitle(rawTitle, url))}</a>`
}
