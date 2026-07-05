import { type ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  accent?: boolean;
}

export function StatCard({ label, value, subtext, icon, accent = false }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white aura-card-lift p-5 transition-all duration-300 hover:border-zinc-300 hover:shadow-sm hover:shadow-zinc-900/5">
      {accent && (
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] to-violet-500/[0.02]" />
      )}
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className={`text-2xl font-bold tracking-tight ${accent ? "text-cyan-600" : "text-zinc-900"}`}>
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-zinc-500">{subtext}</p>
          )}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? "bg-cyan-500/10 text-cyan-600" : "bg-zinc-100 text-zinc-500"}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
