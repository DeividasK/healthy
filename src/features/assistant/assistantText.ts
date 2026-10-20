/**
 * Hides Qwen3's reasoning. Thinking is turned off, but the model may still
 * open its reply with an empty `<think></think>` block. While a block is
 * still streaming, everything after its opening tag is hidden.
 */
export function stripThinking(text: string): string {
  const withoutBlocks = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = withoutBlocks.indexOf('<think>');
  return (open < 0 ? withoutBlocks : withoutBlocks.slice(0, open)).trimStart();
}

/** Shortens free text to `max` characters, ending in an ellipsis. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Joins sections of lines, leaving out the lines that would push the text
 * past `maxChars` so the prompt fits a small model's context window. Each
 * section lists its most important records first.
 */
export function fitSections(
  sections: { heading: string; lines: string[] }[],
  maxChars: number
): string {
  let used = 0;
  let omitted = 0;
  const parts: string[] = [];
  for (const { heading, lines } of sections) {
    if (lines.length === 0) continue;
    const kept: string[] = [];
    for (const line of lines) {
      const cost =
        line.length + 1 + (kept.length === 0 ? heading.length + 2 : 0);
      if (used + cost > maxChars) {
        omitted++;
        continue;
      }
      used += cost;
      kept.push(line);
    }
    if (kept.length > 0) parts.push([heading, ...kept].join('\n'));
  }
  if (omitted > 0)
    parts.push(
      `(${omitted} more record${omitted === 1 ? '' : 's'} left out to keep this short.)`
    );
  return parts.join('\n\n');
}

/** A download size such as "350 MB" or "2.3 GB" (decimal units, as stores show them). */
export function formatBytes(bytes: number): string {
  return bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.round(bytes / 1e6)} MB`;
}
