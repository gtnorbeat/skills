import { describe, it, expect } from "vitest";
import { deriveFailureMode, type ColdBootInputs } from "@/utils/deriveFailureMode";

/** All-10-null input — every fetch rejected. */
function allNull(): ColdBootInputs {
  return {
    demos: null, artists: null, contracts: null, tasks: null,
    releases: null, campaigns: null, revenue: null, actions: null,
    activities: null, notifications: null,
  };
}

/** All-10-empty (resolved, zero rows). */
function allEmpty(): ColdBootInputs {
  return {
    demos: [], artists: [], contracts: [], tasks: [],
    releases: [], campaigns: [],
    revenue: { totalRevenue: 0, monthlyRevenue: 0, pendingPayouts: 0, revenueByArtist: [], revenueByRelease: [], currency: "EUR" },
    actions: [], activities: [], notifications: [],
  };
}

/** Single section has data — one valid Artist row. */
function oneWithData(): ColdBootInputs {
  return {
    ...allEmpty(),
    artists: [{
      id: "a1", name: "Tester", label: "Test", status: "active",
      imageUrl: "", genres: [], socialLinks: [], totalReleases: 0,
      signedSince: "2024-01-01", bio: "",
    }],
  };
}

describe("deriveFailureMode", () => {
  it('returns "outage" when all 10 fetches are null (every fetch rejected)', () => {
    expect(deriveFailureMode(allNull())).toBe("outage");
  });

  it('returns "empty" when all 10 fetches succeeded but every section is empty', () => {
    expect(deriveFailureMode(allEmpty())).toBe("empty");
  });

  it("returns null (partial) when some sections have data and others are null", () => {
    const partial: ColdBootInputs = {
      ...allEmpty(),
      contracts: null,
    };
    expect(deriveFailureMode(partial)).toBeNull();
  });

  it("returns null (partial) when a single fetch failed and the rest are empty", () => {
    const partial: ColdBootInputs = {
      ...allEmpty(),
      demos: null,
    };
    expect(deriveFailureMode(partial)).toBeNull();
  });

  it("returns null when at least one section has real data", () => {
    expect(deriveFailureMode(oneWithData())).toBeNull();
  });

  it("returns null when revenue alone is non-zero", () => {
    const input: ColdBootInputs = {
      ...allEmpty(),
      revenue: { totalRevenue: 5000, monthlyRevenue: 1000, pendingPayouts: 200, revenueByArtist: [], revenueByRelease: [], currency: "EUR" },
    };
    expect(deriveFailureMode(input)).toBeNull();
  });

  it("returns null when all 10 resolve with mixed empty and populated", () => {
    const input: ColdBootInputs = {
      ...allEmpty(),
      artists: [{
        id: "a1", name: "X", label: "L", status: "active",
        imageUrl: "", genres: [], socialLinks: [], totalReleases: 0,
        signedSince: "2024-01-01", bio: "",
      }],
      releases: [{
        id: "r1", artistId: "a1", artist: "X", title: "Single",
        status: "scheduled", catalogNumber: "CAT001", releaseDate: "2025-06-01",
        readinessPercentage: 0, tracks: [], artworkUrl: "", genres: [],
        launchChecklist: [], needsAttention: false, priority: "medium",
        promoAssetsReady: false, distributorSubmitted: false,
      }],
    };
    expect(deriveFailureMode(input)).toBeNull();
  });
});
