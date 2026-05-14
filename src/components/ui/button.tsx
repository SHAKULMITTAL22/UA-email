import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-canvas transition-colors duration-ua ease-ua-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aiAccent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-aiAccent text-canvas hover:bg-aiAccent/90",
        secondary:
          "bg-card text-textPrimary border border-cardBorder hover:bg-white/[0.06]",
        ghost:
          "text-textPrimary hover:bg-white/[0.04]",
        outline:
          "border border-cardBorder bg-transparent text-textPrimary hover:bg-white/[0.04]",
        link:
          "text-aiAccent underline-offset-4 hover:underline",
        destructive:
          "bg-red-500/90 text-white hover:bg-red-500",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
