"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { ImageIcon } from "lucide-react";

interface Props {
  bodyHtml?: string;
  bodyText: string;
}

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "figure",
  "figcaption",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "rel",
  "target",
  "width",
  "height",
  "style",
  "class",
];

export function MessageBody({ bodyHtml, bodyText }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showImages, setShowImages] = useState(false);
  const [hasImages, setHasImages] = useState(false);

  const sanitized = useMemo(() => {
    if (!bodyHtml) return null;
    return DOMPurify.sanitize(bodyHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      FORBID_TAGS: [
        "script",
        "style",
        "link",
        "meta",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
      ],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
      ADD_ATTR: ["target", "rel"],
    });
  }, [bodyHtml]);

  // Inject the sanitized HTML via ref (not dangerouslySetInnerHTML) so React
  // never owns these children — our image/link hardening mutations survive
  // subsequent re-renders. Gmail-style: images stay blocked until opt-in.
  useEffect(() => {
    const root = ref.current;
    if (!root || sanitized === null) return;
    root.innerHTML = sanitized;

    const imgs = Array.from(root.querySelectorAll("img"));
    setHasImages(imgs.length > 0);

    if (!showImages) {
      imgs.forEach((img) => {
        const current = img.getAttribute("src");
        if (current) img.dataset["originalSrc"] = current;
        img.removeAttribute("src");
        img.style.display = "none";
      });
    } else {
      imgs.forEach((img) => {
        const original = img.dataset["originalSrc"];
        if (original) img.setAttribute("src", original);
        img.style.display = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.style.maxWidth = "100%";
        img.style.height = "auto";
      });
    }

    // Harden every link — external opens in new tab with noopener.
    const links = Array.from(root.querySelectorAll("a"));
    links.forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("mailto:")) {
        a.classList.add("mailto-link");
      } else if (href && !href.startsWith("#")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
    });
  }, [sanitized, showImages]);

  if (!sanitized) {
    return (
      <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-textPrimary/90 [&_a]:text-aiAccent [&_a]:underline">
        {linkifyText(bodyText)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        key="image-toggle"
        type="button"
        onClick={() => setShowImages((v) => !v)}
        hidden={!hasImages}
        className="inline-flex items-center gap-1.5 rounded-md border border-cardBorder bg-canvasSecondary px-2.5 py-1 text-xs font-medium text-textSecondary transition-colors hover:border-aiAccent hover:text-aiAccent"
      >
        <ImageIcon className="h-3 w-3" />
        {showImages ? "Hide images" : "Show images"}
      </button>
      <div
        key="message-html"
        ref={ref}
        className="prose prose-sm prose-slate max-w-none text-textPrimary/90
          [&_a]:text-aiAccent [&_a]:underline [&_a]:decoration-aiAccent/30 hover:[&_a]:decoration-aiAccent
          [&_img]:rounded-md [&_img]:my-2
          [&_blockquote]:border-l-2 [&_blockquote]:border-cardBorder [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-textMuted
          [&_table]:text-xs [&_table]:border-collapse [&_table_td]:border [&_table_td]:border-cardBorder [&_table_td]:px-2 [&_table_td]:py-1
          [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm
          [&_pre]:bg-canvasTinted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:text-xs
          [&_code]:bg-canvasTinted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs"
      />
    </div>
  );
}

function linkifyText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s)<>]+|www\.[^\s)<>]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const raw = match[0];
    const url = raw.startsWith("www.") ? `https://${raw}` : raw;
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-aiAccent underline"
      >
        {raw}
      </a>,
    );
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
