import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

type InlinePart =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "code"; value: string };

function parseInlineMarkdown(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }

    if (matchedText.startsWith("**")) {
      parts.push({ type: "bold", value: matchedText.slice(2, -2) });
    } else {
      parts.push({ type: "code", value: matchedText.slice(1, -1) });
    }

    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return parseInlineMarkdown(text).map((part, index) => {
    if (part.type === "bold") {
      return (
        <strong key={`${part.type}-${index}`} className="font-semibold">
          {part.value}
        </strong>
      );
    }

    if (part.type === "code") {
      return (
        <code
          key={`${part.type}-${index}`}
          className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.92em]"
        >
          {part.value}
        </code>
      );
    }

    return <Fragment key={`${part.type}-${index}`}>{part.value}</Fragment>;
  });
}

function renderParagraph(paragraph: string, keyPrefix: string) {
  const lines = paragraph
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const listItems = lines.filter((line) => /^[-*]\s+/.test(line));
  if (lines.length > 0 && listItems.length === lines.length) {
    return (
      <ul key={keyPrefix} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`${keyPrefix}-item-${index}`}>{renderInlineMarkdown(item.replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  if (lines.length === 1 && lines[0].startsWith("### ")) {
    return (
      <h4 key={keyPrefix} className="text-sm font-semibold">
        {renderInlineMarkdown(lines[0].slice(4))}
      </h4>
    );
  }

  if (lines.length === 1 && lines[0].startsWith("## ")) {
    return (
      <h3 key={keyPrefix} className="text-base font-semibold">
        {renderInlineMarkdown(lines[0].slice(3))}
      </h3>
    );
  }

  return (
    <p key={keyPrefix} className="whitespace-pre-wrap leading-relaxed">
      {lines.flatMap((line, index) => {
        const rendered = renderInlineMarkdown(line);
        if (index === lines.length - 1) {
          return rendered;
        }

        return [...rendered, <br key={`${keyPrefix}-break-${index}`} />];
      })}
    </p>
  );
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  const normalizedContent = content.replace(/\r\n/g, "\n").trim();

  if (!normalizedContent) {
    return null;
  }

  const paragraphs = normalizedContent
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      {paragraphs.map((paragraph, index) => renderParagraph(paragraph, `paragraph-${index}`))}
    </div>
  );
}
