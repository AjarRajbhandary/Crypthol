import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-8 rounded-lg bg-primary flex items-center justify-center shrink-0",
        className,
      )}
    >
      <span className="text-primary-foreground font-bold text-sm">P</span>
    </div>
  );
}
