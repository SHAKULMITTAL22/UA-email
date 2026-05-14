import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-ua ease-ua-out focus:outline-none focus:ring-2 focus:ring-aiAccent focus:ring-offset-2 ring-offset-canvas",
  {
    variants: {
      variant: {
        default: "border-transparent bg-aiAccent text-canvas",
        secondary: "border-cardBorder bg-card text-textPrimary",
        outline: "border-cardBorder bg-transparent text-textPrimary",
        muted: "border-transparent bg-white/[0.06] text-textMuted",
        needsReply: "border-transparent bg-bucket-needsReply/15 text-bucket-needsReply",
        fyi: "border-transparent bg-bucket-fyi/15 text-bucket-fyi",
        newsletter: "border-transparent bg-bucket-newsletter/15 text-bucket-newsletter",
        noise: "border-transparent bg-bucket-noise/15 text-bucket-noise",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
