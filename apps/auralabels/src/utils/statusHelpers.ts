import type { ReleaseStatus, ContractStatus, DemoStatus, CampaignStatus, TaskStatus, Priority } from "@/types";

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: "Draft",
  mastering: "Mastering",
  artwork_pending: "Artwork Pending",
  scheduled: "Scheduled",
  released: "Released",
  archived: "Archived",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  expired: "Expired",
  terminated: "Terminated",
};

export const DEMO_STATUS_LABELS: Record<DemoStatus, string> = {
  new: "New",
  listening: "Listening",
  interested: "Interested",
  rejected: "Rejected",
  accepted: "Accepted",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
  paused: "Paused",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case "critical":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "medium":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/25";
    case "low":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

export function getReleaseStatusColor(status: ReleaseStatus): string {
  switch (status) {
    case "draft":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "mastering":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "artwork_pending":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "scheduled":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "released":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    case "archived":
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}

export function getContractStatusColor(status: ContractStatus): string {
  switch (status) {
    case "draft":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "sent":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "signed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "expired":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "terminated":
      return "bg-red-500/10 text-red-500 border-red-500/20";
  }
}

export function getDemoStatusColor(status: DemoStatus): string {
  switch (status) {
    case "new":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "listening":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "interested":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "rejected":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "accepted":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
}

export function getCampaignStatusColor(status: CampaignStatus): string {
  switch (status) {
    case "planning":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "active":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "completed":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "paused":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
}

export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case "backlog":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "todo":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "in_progress":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "done":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
}

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  exclusive: "Exclusive",
  non_exclusive: "Non-Exclusive",
  distribution: "Distribution",
  licensing: "Licensing",
};

export const GDPR_LABELS: Record<string, string> = {
  compliant: "Compliant",
  pending: "Pending",
  not_applicable: "N/A",
};

export function getGdprColor(status: string): string {
  switch (status) {
    case "compliant":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "not_applicable":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

export const IPI_LABELS: Record<string, string> = {
  registered: "Registered",
  pending: "Pending",
  not_submitted: "Not Submitted",
};

export function getIpiColor(status: string): string {
  switch (status) {
    case "registered":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "not_submitted":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  contract: "Contract",
  artwork: "Artwork",
  mastering: "Mastering",
  promo: "Promo",
  admin: "Admin",
  social: "Social",
  distributor: "Distributor",
  content: "Content",
};

export const LABEL_FIT_LABELS: Record<string, string> = {
  perfect: "Perfect Fit",
  good: "Good Fit",
  moderate: "Moderate",
  poor: "Poor Fit",
};

export function getLabelFitColor(fit: string): string {
  switch (fit) {
    case "perfect":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "good":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "moderate":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "poor":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}
