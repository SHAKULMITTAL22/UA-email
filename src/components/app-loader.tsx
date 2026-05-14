"use client";

export function AppLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3" role="status" aria-label="Loading UA Email">
      <h1 className="font-display italic text-3xl text-textPrimary">UA Email</h1>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span
          className="h-1.5 w-1.5 rounded-full bg-aiAccent animate-pulse"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-aiAccent animate-pulse"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-aiAccent animate-pulse"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
