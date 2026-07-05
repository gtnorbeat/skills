import { type ReactNode } from "react";

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export function DashboardCard({ children, className = "", padding = true, onClick }: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-zinc-200 bg-white aura-card-lift ${padding ? "p-5" : ""} transition-all duration-300 hover:border-zinc-300 hover:shadow-sm hover:shadow-zinc-900/5 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
