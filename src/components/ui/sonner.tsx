"use client";

import * as React from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const DEFAULT_TOAST_CLASSES = {
  toast:
    "!bg-card !backdrop-blur-xl !border-cardBorder !text-textPrimary !font-body !rounded-card",
  title: "!font-medium",
  description: "!text-textMuted",
  success: "!border-aiAccentBorder !text-aiAccent",
  error: "!border-red-500/40 !text-red-300",
} as const;

export function Toaster(props: ToasterProps): React.ReactElement {
  // Allow caller overrides while keeping our defaults.
  const merged: ToasterProps = {
    theme: "dark",
    position: "bottom-right",
    ...props,
    toastOptions: {
      ...props.toastOptions,
      classNames: {
        ...DEFAULT_TOAST_CLASSES,
        ...(props.toastOptions?.classNames ?? {}),
      },
    },
  };
  return <SonnerToaster {...merged} />;
}
