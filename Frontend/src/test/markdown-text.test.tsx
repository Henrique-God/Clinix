import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "@/components/ui/markdown-text";

describe("MarkdownText", () => {
  it("renders headings, bold text and bullet lists", () => {
    render(
      <MarkdownText
        content={`## Resumo\n\n**Importante**\n\n- Item A\n- Item B`}
      />,
    );

    expect(screen.getByText("Resumo")).toBeInTheDocument();
    expect(screen.getByText("Importante").tagName).toBe("STRONG");
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });
});
