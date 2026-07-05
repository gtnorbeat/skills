import type { Release } from "@/types";

export interface ReadinessCategory {
  key: string;
  label: string;
  score: number;
  items: { label: string; done: boolean }[];
  icon: string;
}

export interface ReadinessResult {
  categories: ReadinessCategory[];
  overall: number;
}

export function computeReadinessScores(release: Release): ReadinessResult {
  const categories: ReadinessCategory[] = [
    computeMetadata(release),
    computeArtwork(release),
    computeContract(release),
    computePromo(release),
    computeDistributor(release),
  ];

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  return { categories, overall };
}

function computeMetadata(release: Release): ReadinessCategory {
  const checks = [
    { label: "Genres defined", done: release.genres.length > 0 },
    { label: "Release date set", done: !!release.releaseDate },
    { label: "Tracks added", done: release.tracks.length > 0 },
    {
      label: "Tracks have BPM/key",
      done: release.tracks.every((t) => t.bpm > 0 && t.key),
    },
    {
      label: "All tracks mastered",
      done: release.tracks.length > 0 && release.tracks.every((t) => t.isMastered),
    },
  ];
  return {
    key: "metadata",
    label: "Metadata",
    score: scoreFromChecks(checks),
    items: checks,
    icon: "📋",
  };
}

function computeArtwork(release: Release): ReadinessCategory {
  const artworkChecklistDone = release.launchChecklist
    .filter((i) => i.title.toLowerCase().includes("artwork"))
    .some((i) => i.completed);

  const checks = [
    {
      label: "Artwork uploaded",
      done: !!release.artworkUrl,
    },
    {
      label: "Artwork finalised (checklist)",
      done: artworkChecklistDone,
    },
    {
      label: "Promo assets ready",
      done: release.promoAssetsReady,
    },
  ];
  return {
    key: "artwork",
    label: "Artwork",
    score: scoreFromChecks(checks),
    items: checks,
    icon: "🎨",
  };
}

function computeContract(release: Release): ReadinessCategory {
  const contractChecklistDone = release.launchChecklist
    .filter((i) => i.title.toLowerCase().includes("contract") || i.title.toLowerCase().includes("rights"))
    .some((i) => i.completed);

  // We derive contract readiness from the release status and checklist.
  // A release with status >= scheduled likely has a contract in place.
  const advancedStatus = ["scheduled", "released"].includes(release.status);

  const checks = [
    {
      label: "Contract signed",
      done: contractChecklistDone || advancedStatus,
    },
    {
      label: "Rights cleared",
      done: advancedStatus,
    },
  ];
  return {
    key: "contract",
    label: "Contract",
    score: scoreFromChecks(checks),
    items: checks,
    icon: "📄",
  };
}

function computePromo(release: Release): ReadinessCategory {
  const checklistItems = release.launchChecklist;

  const checks = [
    {
      label: "Press kit prepared",
      done: checklistItems
        .filter((i) => i.title.toLowerCase().includes("press"))
        .some((i) => i.completed),
    },
    {
      label: "Promo campaign launched",
      done: checklistItems
        .filter((i) => i.title.toLowerCase().includes("promo"))
        .some((i) => i.completed),
    },
    {
      label: "Social media assets ready",
      done: checklistItems
        .filter((i) => i.title.toLowerCase().includes("social") || i.title.toLowerCase().includes("media"))
        .some((i) => i.completed),
    },
    {
      label: "Promo assets ready",
      done: release.promoAssetsReady,
    },
  ];
  return {
    key: "promo",
    label: "Promo",
    score: scoreFromChecks(checks),
    items: checks,
    icon: "📢",
  };
}

function computeDistributor(release: Release): ReadinessCategory {
  const checklistDone = release.launchChecklist
    .filter((i) => i.title.toLowerCase().includes("distributor"))
    .some((i) => i.completed);

  const checks = [
    {
      label: "Distributor submission (checklist)",
      done: checklistDone,
    },
    {
      label: "Distributor submitted (flag)",
      done: release.distributorSubmitted,
    },
  ];
  return {
    key: "distributor",
    label: "Distributor",
    score: scoreFromChecks(checks),
    items: checks,
    icon: "📡",
  };
}

function scoreFromChecks(checks: { label: string; done: boolean }[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
}
