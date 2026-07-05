import { type ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  subtitle?: string;
}

export function SectionHeader({ title, action, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
