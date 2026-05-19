'use client';

/**
 * Auto-detect http(s) URLs in plain text and render them as clickable links.
 * Plain text segments render as-is so newlines and other content stay intact.
 *
 * - Stops URLs at whitespace, closing brackets, and common trailing punctuation
 *   so "見 https://foo.com，請點" parses cleanly.
 * - Uses target="_blank" + rel="noopener noreferrer" for safe new-tab open.
 * - Calls e.stopPropagation() on link click so clicking a link inside a
 *   clickable card opens the URL instead of the card's edit handler.
 */

// Capturing regex: parts at odd indices are matched URLs.
// Allow most URL chars; stop at whitespace, ) ] > " ' and trailing , . ; : ! ?
const URL_RE = /(https?:\/\/[^\s)\]>"']+?)(?=[,.;:!?]?(?:\s|[)\]>"']|$))/g;

interface Props {
  text: string | null | undefined;
  className?: string;
  linkClassName?: string;
}

export function LinkifyText({ text, className, linkClassName }: Props) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  const defaultLinkClass = 'text-indigo-600 hover:text-indigo-700 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 break-all';
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;
        // Even index (0, 2, 4, ...) = plain text; odd = URL
        if (i % 2 === 1) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={linkClassName ?? defaultLinkClass}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default LinkifyText;
