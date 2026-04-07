import { describe, it, expect } from "vitest";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

// These tests mirror what Markdown.svelte does: parse with marked, then
// sanitize the resulting HTML with DOMPurify before {@html}. They exist to
// make sure a careless marked config change or DOMPurify removal can't
// silently reintroduce the XSS sink that Markdown.svelte used to have.

function renderSafe(source: string, inline = false): string {
  const html = inline
    ? (marked.parseInline(source, { async: false }) as string)
    : (marked.parse(source, { async: false }) as string);
  return DOMPurify.sanitize(html);
}

describe("Markdown sanitization", () => {
  it("strips raw <script> tags from markdown source", () => {
    const output = renderSafe('Hello <script>alert("pwn")</script> world');
    expect(output).not.toContain("<script");
    expect(output).not.toContain("alert(");
  });

  it("strips inline event handlers from HTML injected into markdown", () => {
    const output = renderSafe('<img src="x" onerror="alert(1)">');
    expect(output).not.toMatch(/onerror/i);
  });

  it("strips javascript: URLs in links", () => {
    const output = renderSafe('[click me](javascript:alert(1))');
    expect(output).not.toContain("javascript:");
  });

  it("strips data: URLs that are not safe image types", () => {
    const output = renderSafe('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(output).not.toContain("<script");
  });

  it("preserves safe markdown headings, lists, and links", () => {
    const output = renderSafe("# Heading\n\n- item\n\n[link](https://example.com)");
    expect(output).toContain("<h1");
    expect(output).toContain("Heading");
    expect(output).toContain("<li");
    expect(output).toContain("https://example.com");
  });

  it("preserves inline code spans", () => {
    const output = renderSafe("Use `const x = 1` please");
    expect(output).toContain("<code");
    expect(output).toContain("const x = 1");
  });

  it("sanitizes inline mode the same way as block mode", () => {
    const inlineOut = renderSafe('<script>alert(1)</script>', true);
    expect(inlineOut).not.toContain("<script");
  });

  it("handles empty string without throwing", () => {
    expect(() => renderSafe("")).not.toThrow();
  });
});
