"use client";

import * as React from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps): React.ReactElement {
  return <SonnerToaster {...props} />;
}
