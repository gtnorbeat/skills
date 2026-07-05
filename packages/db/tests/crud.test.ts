/**
 * Database CRUD integration tests.
 *
 * These tests exercise the actual Drizzle ORM schema against a real
 * Neon Postgres database. They require DATABASE_URL to be set in the
 * environment and tables to exist (run `drizzle-kit push` first).
 *
 * Tables are cleaned between each test via setup.ts so tests don't
 * interfere with each other.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, isDbAvailable, testId, resetCounter } from "./setup.js";
import * as s from "../src/schema.js";

// Typed shapes for JSONB columns so assertions are type-safe.
interface TrackRecord {
  id: string;
  title: string;
  duration: string;
  bpm: number;
  key: string;
  isMastered: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
}

// Skip all tests if no database connection.
const itDb = isDbAvailable ? it : it.skip;
const describeDb = isDbAvailable ? describe : describe.skip;

describeDb("Database CRUD", () => {
  beforeAll(() => resetCounter());

  // ── Artists ─────────────────────────────────────────────────────

  describe("Artists", () => {
    itDb("inserts and reads an artist", async () => {
      const id = testId("art");
      const artist = {
        id,
        name: "Test Artist",
        label: "Test Label",
        status: "active",
        genres: ["Melodic Techno", "Progressive House"],
        socialLinks: [{ platform: "SoundCloud", url: "https://sc.com/test" }],
        totalReleases: 0,
        signedSince: "2025-01-01",
        bio: "A test artist for integration tests.",
        imageUrl: "",
      };

      await db.insert(s.auralabelsArtists).values(artist);

      const rows = await db
        .select()
        .from(s.auralabelsArtists)
        .where(eq(s.auralabelsArtists.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Test Artist");
      expect(rows[0].genres).toEqual(["Melodic Techno", "Progressive House"]);
      expect(rows[0].socialLinks).toEqual([
        { platform: "SoundCloud", url: "https://sc.com/test" },
      ]);
      expect(rows[0].createdAt).toBeInstanceOf(Date);
      expect(rows[0].updatedAt).toBeInstanceOf(Date);
    });

    itDb("updates an artist", async () => {
      const id = testId("art");
      await db.insert(s.auralabelsArtists).values({
        id,
        name: "Old Name",
        label: "Test Label",
        status: "active",
        genres: [],
        socialLinks: [],
        totalReleases: 0,
        signedSince: "",
        bio: "",
        imageUrl: "",
      });

      await db
        .update(s.auralabelsArtists)
        .set({ name: "New Name", status: "inactive" })
        .where(eq(s.auralabelsArtists.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsArtists)
        .where(eq(s.auralabelsArtists.id, id));

      expect(rows[0].name).toBe("New Name");
      expect(rows[0].status).toBe("inactive");
    });

    itDb("deletes an artist", async () => {
      const id = testId("art");
      await db.insert(s.auralabelsArtists).values({
        id, name: "Delete Me", label: "X", status: "active",
        genres: [], socialLinks: [], totalReleases: 0,
        signedSince: "", bio: "", imageUrl: "",
      });

      await db
        .delete(s.auralabelsArtists)
        .where(eq(s.auralabelsArtists.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsArtists)
        .where(eq(s.auralabelsArtists.id, id));

      expect(rows).toHaveLength(0);
    });

    itDb("lists multiple artists", async () => {
      await db.insert(s.auralabelsArtists).values([
        { id: testId("art"), name: "Artist A", label: "L1", status: "active", genres: [], socialLinks: [], totalReleases: 0, signedSince: "", bio: "", imageUrl: "" },
        { id: testId("art"), name: "Artist B", label: "L1", status: "active", genres: [], socialLinks: [], totalReleases: 0, signedSince: "", bio: "", imageUrl: "" },
        { id: testId("art"), name: "Artist C", label: "L1", status: "inactive", genres: [], socialLinks: [], totalReleases: 0, signedSince: "", bio: "", imageUrl: "" },
      ]);

      const all = await db.select().from(s.auralabelsArtists);
      expect(all).toHaveLength(3);
    });
  });

  // ── Releases ────────────────────────────────────────────────────

  describe("Releases", () => {
    itDb("inserts and reads a release with tracks and checklist", async () => {
      const id = testId("rel");
      const release = {
        id,
        catalogNumber: "TEST001",
        title: "Test Release",
        artist: "Test Artist",
        artistId: "test-art-1",
        status: "draft",
        priority: "high",
        releaseDate: "2025-06-01",
        tracks: [
          { id: "t1", title: "Track 1", duration: "6:00", bpm: 128, key: "A min", isMastered: false },
        ],
        genres: ["Melodic Techno"],
        launchChecklist: [
          { id: "c1", title: "Mastering", completed: false, required: true },
        ],
        readinessPercentage: 50,
        promoAssetsReady: false,
        distributorSubmitted: false,
        needsAttention: true,
        artworkUrl: "",
      };

      await db.insert(s.auralabelsReleases).values(release);

      const rows = await db
        .select()
        .from(s.auralabelsReleases)
        .where(eq(s.auralabelsReleases.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Test Release");
      expect((rows[0].tracks as TrackRecord[])).toHaveLength(1);
      expect((rows[0].tracks as TrackRecord[])[0].title).toBe("Track 1");
      expect((rows[0].launchChecklist as ChecklistItem[])).toHaveLength(1);
      expect(rows[0].readinessPercentage).toBe(50);
      expect(rows[0].needsAttention).toBe(true);
    });

    itDb("updates release status and checklist", async () => {
      const id = testId("rel");
      await db.insert(s.auralabelsReleases).values({
        id, catalogNumber: "UP001", title: "Update Test", artist: "A",
        artistId: "a1", status: "draft", priority: "medium", releaseDate: "",
        tracks: [], genres: [], launchChecklist: [], readinessPercentage: 0,
        promoAssetsReady: false, distributorSubmitted: false, needsAttention: false,
        artworkUrl: "",
      });

      await db
        .update(s.auralabelsReleases)
        .set({
          status: "released",
          readinessPercentage: 100,
          needsAttention: false,
          launchChecklist: [
            { id: "c1", title: "All done", completed: true, required: true },
          ],
        })
        .where(eq(s.auralabelsReleases.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsReleases)
        .where(eq(s.auralabelsReleases.id, id));

      expect(rows[0].status).toBe("released");
      expect(rows[0].readinessPercentage).toBe(100);
      expect(rows[0].needsAttention).toBe(false);
      expect((rows[0].launchChecklist as ChecklistItem[])[0].completed).toBe(true);
    });

    itDb("deletes a release", async () => {
      const id = testId("rel");
      await db.insert(s.auralabelsReleases).values({
        id, catalogNumber: "DEL001", title: "Delete", artist: "A",
        artistId: "a1", status: "draft", priority: "low", releaseDate: "",
        tracks: [], genres: [], launchChecklist: [], readinessPercentage: 0,
        promoAssetsReady: false, distributorSubmitted: false, needsAttention: false,
        artworkUrl: "",
      });

      await db.delete(s.auralabelsReleases).where(eq(s.auralabelsReleases.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsReleases)
        .where(eq(s.auralabelsReleases.id, id));

      expect(rows).toHaveLength(0);
    });
  });

  // ── Demos ───────────────────────────────────────────────────────

  describe("Demos", () => {
    itDb("inserts with all fields populated", async () => {
      const id = testId("demo");
      await db.insert(s.auralabelsDemos).values({
        id,
        artistName: "Lunar Tide",
        email: "lunar@test.com",
        instagram: "@lunar",
        trackTitle: "Depth Charge",
        genre: "Melodic Techno",
        duration: "6:30",
        bpm: 126,
        key: "A min",
        receivedDate: "2025-01-15",
        status: "listening",
        rating: 4,
        labelFit: "good",
        privateLink: "https://sc.com/private",
        audioUrl: "",
        notes: "Strong arrangement",
        nextAction: "Schedule call",
      });

      const rows = await db
        .select()
        .from(s.auralabelsDemos)
        .where(eq(s.auralabelsDemos.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].artistName).toBe("Lunar Tide");
      expect(rows[0].rating).toBe(4);
      expect(rows[0].labelFit).toBe("good");
      expect(rows[0].status).toBe("listening");
    });

    itDb("inserts with nullable fields as null", async () => {
      const id = testId("demo");
      await db.insert(s.auralabelsDemos).values({
        id,
        artistName: "New Artist",
        trackTitle: "New Track",
        genre: "Techno",
      });

      const rows = await db
        .select()
        .from(s.auralabelsDemos)
        .where(eq(s.auralabelsDemos.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].rating).toBeNull();
      expect(rows[0].labelFit).toBeNull();
    });

    itDb("updates demo status and rating", async () => {
      const id = testId("demo");
      await db.insert(s.auralabelsDemos).values({
        id, artistName: "A", trackTitle: "T", genre: "T", status: "new",
      });

      await db
        .update(s.auralabelsDemos)
        .set({ status: "rejected", rating: 2, notes: "Not a fit" })
        .where(eq(s.auralabelsDemos.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsDemos)
        .where(eq(s.auralabelsDemos.id, id));

      expect(rows[0].status).toBe("rejected");
      expect(rows[0].rating).toBe(2);
      expect(rows[0].notes).toBe("Not a fit");
    });

    itDb("deletes a demo", async () => {
      const id = testId("demo");
      await db.insert(s.auralabelsDemos).values({
        id, artistName: "D", trackTitle: "D", genre: "D",
      });

      await db.delete(s.auralabelsDemos).where(eq(s.auralabelsDemos.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsDemos)
        .where(eq(s.auralabelsDemos.id, id));

      expect(rows).toHaveLength(0);
    });
  });

  // ── Contracts ───────────────────────────────────────────────────

  describe("Contracts", () => {
    itDb("inserts and reads a contract with nullable dates", async () => {
      const id = testId("ctr");
      await db.insert(s.auralabelsContracts).values({
        id,
        artist: "Test Artist",
        artistId: "test-art-1",
        type: "exclusive",
        status: "draft",
        priority: "high",
        revenueShare: 50,
        value: 5000,
        rights: "Master rights",
        gdprStatus: "pending",
        ipiStatus: "not_submitted",
        notes: "Draft contract for testing",
      });

      const rows = await db
        .select()
        .from(s.auralabelsContracts)
        .where(eq(s.auralabelsContracts.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("exclusive");
      expect(rows[0].status).toBe("draft");
      expect(rows[0].signedDate).toBeNull();
      expect(rows[0].expiryDate).toBeNull();
      expect(rows[0].revenueShare).toBe(50);
      expect(rows[0].value).toBeCloseTo(5000);
    });

    itDb("updates contract to signed with dates", async () => {
      const id = testId("ctr");
      await db.insert(s.auralabelsContracts).values({
        id, artist: "A", artistId: "a1", status: "draft", revenueShare: 50,
        value: 0, rights: "", gdprStatus: "pending", ipiStatus: "pending",
        notes: "",
      });

      await db
        .update(s.auralabelsContracts)
        .set({
          status: "signed",
          signedDate: "2025-03-15",
          expiryDate: "2028-03-15",
          gdprStatus: "compliant",
          ipiStatus: "registered",
        })
        .where(eq(s.auralabelsContracts.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsContracts)
        .where(eq(s.auralabelsContracts.id, id));

      expect(rows[0].status).toBe("signed");
      expect(rows[0].signedDate).toBe("2025-03-15");
      expect(rows[0].expiryDate).toBe("2028-03-15");
      expect(rows[0].gdprStatus).toBe("compliant");
    });

    itDb("deletes a contract", async () => {
      const id = testId("ctr");
      await db.insert(s.auralabelsContracts).values({
        id, artist: "D", artistId: "d1", status: "draft", revenueShare: 50,
        value: 0, rights: "", gdprStatus: "pending", ipiStatus: "pending",
        notes: "",
      });

      await db.delete(s.auralabelsContracts).where(eq(s.auralabelsContracts.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsContracts)
        .where(eq(s.auralabelsContracts.id, id));

      expect(rows).toHaveLength(0);
    });
  });

  // ── Tasks ───────────────────────────────────────────────────────

  describe("Tasks", () => {
    itDb("inserts and reads a task", async () => {
      const id = testId("task");
      await db.insert(s.auralabelsTasks).values({
        id,
        title: "Review final master",
        description: "Listen and approve mastering for ORB005",
        status: "in_progress",
        priority: "high",
        category: "mastering",
        dueDate: "2025-06-15",
        assignee: "admin",
        relatedToType: "release",
        relatedToId: "rel-123",
        relatedToTitle: "ORB005 — Final",
        overdue: false,
      });

      const rows = await db
        .select()
        .from(s.auralabelsTasks)
        .where(eq(s.auralabelsTasks.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Review final master");
      expect(rows[0].status).toBe("in_progress");
      expect(rows[0].category).toBe("mastering");
      expect(rows[0].relatedToType).toBe("release");
      expect(rows[0].overdue).toBe(false);
    });

    itDb("updates task status", async () => {
      const id = testId("task");
      await db.insert(s.auralabelsTasks).values({
        id, title: "Old task", description: "", status: "todo",
        priority: "medium", category: "admin", dueDate: "", assignee: "",
        overdue: false,
      });

      await db
        .update(s.auralabelsTasks)
        .set({ status: "done", overdue: false })
        .where(eq(s.auralabelsTasks.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsTasks)
        .where(eq(s.auralabelsTasks.id, id));

      expect(rows[0].status).toBe("done");
    });

    itDb("deletes a task", async () => {
      const id = testId("task");
      await db.insert(s.auralabelsTasks).values({
        id, title: "Delete me", description: "", status: "backlog",
        priority: "low", category: "admin", dueDate: "", assignee: "",
        overdue: false,
      });

      await db.delete(s.auralabelsTasks).where(eq(s.auralabelsTasks.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsTasks)
        .where(eq(s.auralabelsTasks.id, id));

      expect(rows).toHaveLength(0);
    });
  });

  // ── Users ───────────────────────────────────────────────────────

  describe("Users", () => {
    itDb("inserts and reads a user", async () => {
      const id = testId("usr");
      await db.insert(s.auralabelsUsers).values({
        id,
        username: "testuser",
        passwordHash: "$2b$10$hashedpassword1234567890123456789012",
        role: "user",
      });

      const rows = await db
        .select()
        .from(s.auralabelsUsers)
        .where(eq(s.auralabelsUsers.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe("testuser");
      expect(rows[0].role).toBe("user");
      expect(rows[0].disabled).toBe(false);
    });

    itDb("enforces unique username constraint", async () => {
      const id1 = testId("usr");
      const id2 = testId("usr");

      await db.insert(s.auralabelsUsers).values({
        id: id1,
        username: "duplicate-name",
        passwordHash: "hash1",
        role: "user",
      });

      // Second insert with same username should fail.
      await expect(
        db.insert(s.auralabelsUsers).values({
          id: id2,
          username: "duplicate-name",
          passwordHash: "hash2",
          role: "admin",
        }),
      ).rejects.toThrow();
    });

    itDb("updates user role and disabled status", async () => {
      const id = testId("usr");
      await db.insert(s.auralabelsUsers).values({
        id, username: "role-test", passwordHash: "hash", role: "user",
      });

      await db
        .update(s.auralabelsUsers)
        .set({ role: "admin", disabled: true })
        .where(eq(s.auralabelsUsers.id, id));

      const rows = await db
        .select()
        .from(s.auralabelsUsers)
        .where(eq(s.auralabelsUsers.id, id));

      expect(rows[0].role).toBe("admin");
      expect(rows[0].disabled).toBe(true);
    });
  });

  // ── Default values ──────────────────────────────────────────────

  describe("Default values", () => {
    itDb("applies default column values on insert", async () => {
      const id = testId("art");
      // Only set required fields — column defaults fill the rest.
      await db.insert(s.auralabelsArtists).values({
        id, name: "Minimal Artist", label: "",
        signedSince: "", bio: "", imageUrl: "",
      });

      const rows = await db
        .select()
        .from(s.auralabelsArtists)
        .where(eq(s.auralabelsArtists.id, id));

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("active");
      expect(rows[0].genres).toEqual([]);
      expect(rows[0].socialLinks).toEqual([]);
      expect(rows[0].totalReleases).toBe(0);
    });
  });
});
