export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function daysUntil(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return date < now;
}

export function daysAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

export function getRelativeDateLabel(dateString: string): {
  label: string;
  urgent: boolean;
} {
  const days = daysUntil(dateString);

  if (days < 0) return { label: `${Math.abs(days)} days overdue`, urgent: true };
  if (days === 0) return { label: "Today", urgent: true };
  if (days === 1) return { label: "Tomorrow", urgent: false };
  if (days <= 7) return { label: `In ${days} days`, urgent: false };
  if (days <= 30) return { label: `In ${Math.floor(days / 7)} weeks`, urgent: false };
  return { label: formatDateShort(dateString), urgent: false };
}
