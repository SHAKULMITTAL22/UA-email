"use client";

import * as React from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const DEFAULT_TOAST_CLASSES = {
  toast:
    "!bg-canvasSecondary !border-cardBorder !text-textPrimary !shadow-cardHover !font-body !rounded-card",
  title: "!font-medium",
  description: "!text-textMuted",
  success: "!border-aiAccentBorder !text-aiAccentDeep",
  error: "!border-red-300 !text-red-700",
} as const;

export function Toaster(props: ToasterProps): React.ReactElement {
  const merged: ToasterProps = {
    theme: "light",
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
