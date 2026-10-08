/** Restore the app's head before hydration without touching SEO or hero markup. */
export function normalizeNetlifyHead(document: Document) {
  for (const node of Array.from(document.head.childNodes)) {
    if (
      node.nodeType !== 8 ||
      !node.textContent?.trim().startsWith("This site is hosted on Netlify.")
    )
      continue;
    const separator = node.previousSibling;
    const charset = separator?.previousSibling;
    // The hosting annotation inserts a newline after charset. React skips the
    // comment but cannot hydrate HeadContent's JSON-LD script past this text,
    // so it recovers the whole document and restarts the SSR hero's CSS timeline.
    if (
      separator?.nodeType === 3 &&
      !separator.textContent?.trim() &&
      charset?.nodeType === 1 &&
      (charset as Element).matches("meta[charset]")
    )
      separator.remove();
  }
}
