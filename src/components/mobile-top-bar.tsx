"use client";

import { Menu, Pencil } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";

interface MobileTopBarProps {
  onMenuClick: () => void;
  onCompose: () => void;
}

export function MobileTopBar({ onMenuClick, onCompose }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-cardBorder bg-canvas/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-md p-2 text-textPrimary transition-colors hover:bg-aiAccentSoft hover:text-aiAccent"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Wordmark size="sm" />
      <Button size="icon" variant="ghost" onClick={onCompose} aria-label="Compose">
        <Pencil className="h-4 w-4" />
      </Button>
    </header>
  );
}
