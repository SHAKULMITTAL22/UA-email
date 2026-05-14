"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const LETTERS = "UA Email".split("");

interface WordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Wordmark({ size = "md", className }: WordmarkProps) {
  const sizeClass = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-5xl sm:text-6xl",
    xl: "text-6xl sm:text-7xl md:text-8xl",
  }[size];

  return (
    <span
      className={cn(
        "group relative inline-flex items-baseline gap-[0.05em] leading-none",
        sizeClass,
        className,
      )}
      role="img"
      aria-label="UA Email"
    >
      {LETTERS.map((char, i) => {
        const isItalicGroup = i > 2; // chars 3..7 = "Email"
        if (char === " ") {
          return <span key={i} aria-hidden className="inline-block w-[0.25em]" />;
        }
        return (
          <motion.span
            key={i}
            aria-hidden
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: i * 0.04,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className={
              isItalicGroup
                ? "inline-block font-display italic text-aiAccent transition-transform duration-300 motion-safe:group-hover:-rotate-[1.5deg]"
                : "inline-block font-display text-textPrimary"
            }
          >
            {char}
          </motion.span>
        );
      })}
      {/* Accent stripe sweep on hover — purely decorative */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-aiAccent/70 transition-transform duration-500 ease-out motion-safe:group-hover:scale-x-100"
      />
    </span>
  );
}
