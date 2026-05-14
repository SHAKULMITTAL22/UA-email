"use client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props { value: string; onChange: (v: string) => void }

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search inbox…  e.g. bucket:needs_reply from:sarah"
        className="pl-9 pr-9 bg-card border-cardBorder"
        aria-label="Search messages"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
