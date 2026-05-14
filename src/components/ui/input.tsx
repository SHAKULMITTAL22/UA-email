import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full rounded-md border border-cardBorder bg-canvasSecondary px-3 py-2 text-sm text-textPrimary placeholder:text-textDim ring-offset-canvas transition-colors duration-ua ease-ua-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-textPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aiAccent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
