import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MessageBody } from "@/components/message-body";

describe("MessageBody", () => {
  it("renders sanitized HTML and strips script tags", () => {
    const dirty = `<p>hello <strong>world</strong></p><script>alert('xss')</script>`;
    const { container } = render(<MessageBody bodyText="fallback" bodyHtml={dirty} />);
    const proseContainer = container.querySelector("[class*='prose']") as HTMLElement;
    expect(proseContainer).toBeTruthy();
    expect(proseContainer.innerHTML).toContain("<strong>world</strong>");
    expect(proseContainer.innerHTML).not.toContain("<script");
    expect(proseContainer.innerHTML).not.toContain("alert(");
  });

  it("strips inline event handlers and javascript: hrefs", () => {
    const dirty = `<a href="javascript:alert(1)" onclick="alert(2)">click</a>`;
    const { container } = render(<MessageBody bodyText="fallback" bodyHtml={dirty} />);
    const html = container.innerHTML;
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onclick");
  });

  it("falls back to plain text with linkified URLs when bodyHtml is missing", () => {
    render(<MessageBody bodyText="Visit https://example.com today" />);
    const link = screen.getByRole("link", { name: /https:\/\/example\.com/i });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides images by default and exposes a show-images toggle", async () => {
    const dirty = `<p>look</p><img src="https://tracking.example/pixel.gif" alt="hi" />`;
    render(<MessageBody bodyText="fallback" bodyHtml={dirty} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /show images/i })).toBeInTheDocument();
    });
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    await waitFor(() => {
      expect(img?.getAttribute("src")).toBeNull();
    });
  });
});
