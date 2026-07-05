# AURA — User Guide

> **A&R Utility & Revenue Assistant**
>
> How to run your label from one dashboard.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [How AURA Is Built](#2-how-aura-is-built)
3. [The Dashboard](#3-the-dashboard)
4. [Managing Your Artist Roster](#4-managing-your-artist-roster)
5. [Release Pipeline](#5-release-pipeline)
6. [Rights & Contracts](#6-rights--contracts)
7. [Demo Inbox](#7-demo-inbox)
8. [Promo Campaigns](#8-promo-campaigns)
9. [Calendar & Tasks](#9-calendar--tasks)
10. [Revenue Tracking](#10-revenue-tracking)
11. [AI Assistant](#11-ai-assistant)
12. [Content Engine](#12-content-engine)
13. [Settings](#13-settings)
14. [Security & Access](#14-security--access)
15. [Quick Reference](#15-quick-reference)

---

## 1. Getting Started

### Signing In

1. Navigate to [https://auralabels.app](https://auralabels.app)
2. Enter your username and password
3. You'll land on the Dashboard

Your session lasts **7 days**. After that, you'll be redirected to sign in again.

### The Interface

AURA has three main regions:

- **Left Sidebar** — Navigation between all surfaces. Active item is highlighted in orange with a small dot indicator.
- **Top Header** — Page title, notification bell, AI toggle (on desktop), and your user menu (avatar + username).
- **Main Content** — The active surface. Every page has a dark background with zinc-toned cards.

The aesthetic is intentionally dark and minimal — designed for long studio sessions without eye strain.

### Navigation Surfaces

| Surface | Route | What you do there |
|---------|-------|-------------------|
| Dashboard | `/` | Today's priorities at a glance |
| AI Assistant | `/ai` | Generate copy and strategy with AI |
| Content Engine | `/content` | Platform-specific content generation |
| Artists | `/artists` | Manage your roster |
| Releases | `/releases` | Track your release pipeline |
| Contracts | `/contracts` | Manage rights and agreements |
| Demo Inbox | `/demo-inbox` | Review artist submissions |
| Promo Campaigns | `/promo` | Plan and run campaigns |
| Calendar | `/calendar` | Tasks and deadlines |
| Revenue | `/revenue` | Track earnings and payouts |
| Settings | `/settings` | Configure your label |

---

## 2. How AURA Is Built

### System Architecture

AURA has two parts that work together:

```
┌──────────────────────────────────────────────────────┐
│                   Your Browser                        │
│                                                      │
│   ┌──────────┐  ──── JWT token ────►  ┌──────────┐  │
│   │ Frontend │                         │   API    │  │
│   │ (React)  │ ◄──── JSON data ──────  │ (Worker) │  │
│   └──────────┘                         └────┬─────┘  │
│                                             │        │
│                                      ┌──────┴──────┐ │
│                                      │   Database   │ │
│                                      │  (Postgres)  │ │
│                                      └─────────────┘ │
│                                                      │
│   What you see           What stores your data       │
│   (auralabels.app)       (Neon cloud database)       │
└──────────────────────────────────────────────────────┘
```

- **Frontend** — The React app running in your browser. Every page, form, chart, and card you interact with is rendered here.
- **API** — The Cloudflare Worker that handles all requests. It checks your login, reads and writes your data, generates AI content, and manages file uploads.
- **Database** — Neon Postgres, a cloud database that stores your artists, releases, contracts, demos, tasks, revenue, and settings. All your label data lives here.

### Route Map

Each sidebar surface talks to dedicated API endpoints:

```
  Sidebar Surface             API Endpoints Used
 ──────────────────       ──────────────────────────
  Dashboard               /api/revenue
                          /api/demos
                          /api/campaigns
                          /api/tasks
                          /api/notifications
                          /api/ai-actions
                          /api/activities

  Artists                 /api/artists

  Releases                /api/releases

  Contracts               /api/contracts
                          /api/files (uploads)

  Demo Inbox              /api/demos
                          /api/webhook/:uuid (public intake)

  Promo Campaigns         /api/campaigns

  Calendar                /api/tasks

  Revenue                 /api/revenue

  AI Assistant            /api/ai/generate

  Content Engine          /api/ai/generate

  Settings                /api/admin (team access)
```

### AI Pipeline

When you generate content with the AI Assistant or Content Engine, AURA chains three AI engines:

```
Your Prompt
    │
    ▼
┌──────────────┐
│ 1. OpenRouter │  ← OpenRouter (primary, shows cyan badge)
│   Llama 3.3   │
└──────┬────────┘
       │ fails or not configured?
       ▼
┌──────────────┐
│ 2. Workers AI│  ← Workers AI (fallback, shows emerald badge)
└──────┬───────┘
       │ fails or not configured?
       ▼
┌──────────────┐
│ 3. Template  │  ← Built-in templates (shows zinc badge)
│   Fallback   │     Always available, no key needed
└──────┬───────┘
       │
       ▼
   Your Result
```

This means AURA works even without any AI keys — the template fallback produces platform-aware copy with correct character limits for every channel.

### File Storage

Files you upload (artwork, contracts, demo audio) are stored in **Cloudflare R2**, a secure cloud storage service. They're served through the same `auralabels.app` domain via `/api/files/:key`.

### Security

AURA protects your data with five security layers:

| Layer | What It Does |
|-------|-------------|
| **WAF** | Blocks malicious requests before they reach the app |
| **Zero Trust** | Every request is authenticated at the network edge |
| **Rate Limiting** | Caps failed login attempts (5 per 15 minutes) |
| **Timing-Safe Auth** | Prevents attackers from guessing valid usernames |

---

## 3. The Dashboard

The Dashboard is your operational cockpit. It shows everything that needs your attention today.

### What You See

- **Today's Priorities** — Tasks due today, ranked by priority (critical → high → medium → low)
- **Revenue Overview** — Total revenue, monthly trend, pending payouts
- **Active Campaigns** — Promo campaigns currently running
- **Demo Inbox Summary** — How many demos are awaiting review
- **Deadlines Needing Attention** — Releases and contracts with approaching dates
- **AI Recommendations** — Suggested actions from the AI (copy ideas, strategy prompts)
- **Artist Activity Feed** — Recent actions across your roster

### How to Use It

The Dashboard loads all data in parallel when you sign in. Use it as your morning briefing:

1. Check **Today's Priorities** first — these are things that must be done today
2. Scan **Revenue Overview** for any anomalies
3. Review **Demo Inbox** — new submissions since yesterday
4. Check **Deadlines** for anything due this week
5. Open any item by clicking its card — it takes you to the relevant detail view

---

## 4. Managing Your Artist Roster

### Viewing Your Roster

Navigate to **Artists** (`/artists`). You'll see all artists in your label, with:

- Artist name and image
- **Status badges** — Active, Inactive, Signed, Prospect
- **Profile completeness** — Orange indicators show what's missing (bio, social links, etc.)
- Genre tags
- Total releases count

### Adding an Artist

1. Click **+ Add Artist** (top-right)
2. Fill in: Name, Label, Status, Genres, Bio, Image URL
3. Add social links (Instagram, Spotify, SoundCloud, etc.)
4. Click **Save**

### Editing an Artist

1. Click an artist from the list to open their detail panel
2. Edit any field
3. Click **Save**

### Profile Completeness

Artists with missing information show orange "missing info" indicators. The system tracks:

- Bio (empty?)
- Social links (missing Instagram? Spotify?)
- Image URL
- Upcoming releases

Fill these in to clear the indicators. A complete profile helps the AI Assistant generate better copy.

### Artist Statuses

| Status | Meaning |
|--------|---------|
| **Active** | Currently releasing and performing |
| **Inactive** | On hiatus, no current activity |
| **Signed** | Under active contract |
| **Prospect** | Being considered for signing |

---

## 5. Release Pipeline

### Viewing Releases

Navigate to **Releases** (`/releases`). You'll see all releases with:

- Catalog number
- Title and artist
- **Status badge** — where each release is in the pipeline
- Priority (Critical / High / Medium / Low)
- Release date
- Readiness percentage (orange progress bar)
- "Needs Attention" flag

### Release Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Initial creation, not yet in active pipeline |
| **Mastering** | Audio is being mastered |
| **Artwork Pending** | Waiting on cover art |
| **Scheduled** | Locked release date, all assets ready |
| **Released** | Live on platforms |
| **Archived** | Catalog item, no longer active |

### Creating a Release

1. Click **+ New Release**
2. Enter: Title, Artist, Catalog Number, Release Date, Genres
3. Add tracks (title, duration, BPM, key, mastered status)
4. Upload artwork
5. The **launch checklist** auto-populates — mark items complete as you go

### Readiness Percentage

The orange readiness bar shows how close a release is to launch. It's calculated from:

- Tracks mastered (% of tracks marked as mastered)
- Artwork uploaded (yes/no)
- Launch checklist completion (% of required items checked)
- Promo assets ready (yes/no)
- Distributor submission (yes/no)

**Aim for 80%+** two weeks before release date.

### Launch Checklist

Every release has a checklist with required and optional items. Required items block the readiness percentage. Typical items:

- Mastered WAV files received
- Artwork finalized (3000×3000px minimum)
- ISRC codes assigned
- Distributor metadata submitted
- Promo one-sheet written
- Social assets created

### Track Details

Each track in a release stores:

- Title
- Duration (MM:SS)
- BPM and musical key (rendered in monospace)
- Mastered status (toggle)

---

## 6. Rights & Contracts

### Viewing Contracts

Navigate to **Contracts** (`/contracts`). You'll see all agreements with:

- Artist name
- **Contract type** — Exclusive, Non-Exclusive, Distribution, Licensing
- **Status** — Draft, Sent, Signed, Expired, Terminated
- Priority
- Signed date and expiry date
- Revenue share percentage
- GDPR and IPI compliance status

### Contract Types

| Type | Use Case |
|------|----------|
| **Exclusive** | Artist signs exclusively to your label |
| **Non-Exclusive** | Artist retains rights, label distributes specific releases |
| **Distribution** | Distribution-only deal, no rights transfer |
| **Licensing** | Sync licensing or sample clearance |

### Creating a Contract

1. Click **+ New Contract**
2. Select the artist and contract type
3. Set revenue share percentage (e.g., 50/50 = 50)
4. Enter contract value, rights description, and notes
5. Set signed date and expiry date (if known)
6. Upload the signed PDF via the file uploader
7. Click **Save**

### GDPR & IPI Status

Every contract tracks two compliance fields:

- **GDPR Status** — Compliant / Pending / Not Applicable
- **IPI Status** — Registered / Pending / Not Submitted

These are important for EU-based labels. The system flags contracts where either status is "Pending" as needing attention.

### Contract Expiry

Contracts approaching expiry show a warning in the Dashboard and Notifications. Renew or terminate before the expiry date to keep your rights chain clean.

---

## 7. Demo Inbox

### How Demos Arrive

Demos come in via a **public webhook endpoint** (`/api/webhook/:uuid`). You can connect this to:

- A Make.com (Integromat) scenario that watches a Gmail inbox
- A custom submission form on your label's website
- A Typeform or Google Form with webhook forwarding

Each submission captures: artist name, email, Instagram handle, track title, genre, duration, BPM, key, and a private listening link.

### Reviewing Demos

1. Navigate to **Demo Inbox** (`/demo-inbox`)
2. New demos show an animated "new" badge
3. Click a demo to open its detail panel
4. **Listen** to the track via the private link
5. **Rate** the submission (star rating)
6. Set **Label Fit** — Perfect / Good / Moderate / Poor
7. Update the **Status**:

### Demo Statuses

| Status | Meaning | Next Step |
|--------|---------|-----------|
| **New** | Unreviewed | Listen and rate |
| **Listening** | Currently evaluating | Finish your review |
| **Interested** | Want to follow up | Contact the artist |
| **Rejected** | Not a fit | Archived |
| **Accepted** | Signing the artist | Create artist profile + contract |

### Demo Workflow

The recommended flow:

1. **New** → open, listen, rate
2. If promising → **Listening** → set Label Fit → add notes
3. If you want to sign → **Interested** → reach out to artist
4. If you sign them → **Accepted** → create Artist profile + Contract
5. If not a fit → **Rejected** (soft-deleted, restorable)

---

## 8. Promo Campaigns

### Viewing Campaigns

Navigate to **Promo Campaigns** (`/promo`). Each campaign shows:

- Campaign name
- Linked release and artist
- **Status** — Planning, Active, Completed, Paused
- Priority
- Start and end dates
- Target platforms
- Budget
- Impressions and engagements
- Readiness percentage
- Missing content flags
- Next action

### Creating a Campaign

1. Click **+ New Campaign**
2. Name the campaign and link it to a release
3. Select target platforms (Instagram, Spotify, TikTok, Beatport, YouTube, etc.)
4. Set budget, start date, and end date
5. The **campaign checklist** auto-populates — mark items as you progress

### Campaign Checklist

Each campaign tracks platform-specific deliverables:

| Deliverable | Status Options |
|-------------|---------------|
| Promo Pool | Not Started / In Progress / Done / N/A |
| DJ Feedback | Not Started / In Progress / Done / N/A |
| Instagram Content | Not Started / In Progress / Done / N/A |
| YouTube Teaser | Not Started / In Progress / Done / N/A |
| Beatport Feature Pitch | Not Started / In Progress / Done / N/A |
| Spotify Pitch | Not Started / In Progress / Done / N/A |
| Email Blast | Not Started / In Progress / Done / N/A |

### Campaign Readiness

Similar to releases, campaigns have a readiness percentage. Missing content flags tell you what still needs to be created. Use the **Content Engine** (`/content`) to generate platform-specific copy for each deliverable.

---

## 9. Calendar & Tasks

### Viewing Tasks

Navigate to **Calendar** (`/calendar`). Tasks are displayed with:

- Title and description
- **Status** — Backlog, To Do, In Progress, Done
- Priority (Critical / High / Medium / Low)
- Category (Contract, Artwork, Mastering, Promo, Admin, Social, Distributor, Content)
- Due date
- Assignee
- Related entity (linked release, artist, campaign, or contract)
- **Overdue flag** — red indicator if past due

### Creating a Task

1. Click **+ New Task**
2. Enter title, description, due date, priority, category, and assignee
3. Optionally link it to a release, artist, campaign, or contract
4. Click **Save**

### Task Statuses

| Status | Meaning |
|--------|---------|
| **Backlog** | Not yet prioritized |
| **To Do** | Queued for this sprint/week |
| **In Progress** | Currently working on it |
| **Done** | Completed |

### Overdue Tasks

Tasks past their due date with status ≠ Done show a red "Overdue" flag. These appear in the Dashboard under "Deadlines Needing Attention."

---

## 10. Revenue Tracking

### Viewing Revenue

Navigate to **Revenue** (`/revenue`). You'll see:

- **Total Revenue** — All-time earnings
- **Monthly Revenue** — Current month
- **Pending Payouts** — Earnings not yet distributed
- **Revenue by Artist** — Proportion bars showing which artists generate the most
- **Revenue by Release** — Proportion bars showing which releases earn the most
- **Currency** — EUR (euro)

### Understanding the Data

Revenue data comes from the `/api/revenue` endpoint. The system shows:

- **Monthly trend** — Is revenue growing month-over-month?
- **Artist concentration** — Are you too dependent on one artist?
- **Release performance** — Which releases are your catalog workhorses?

Use this surface to make signing and marketing decisions. If one artist generates 60% of revenue, you need to diversify. If one release from two years ago still earns, you have catalog value.

---

## 11. AI Assistant

### What It Does

The AI Assistant generates copy and strategy, wired to your actual label data. It knows your artists, releases, and contracts — so it can produce context-aware output.

### Using the AI Assistant

1. Navigate to **AI Assistant** (`/ai`)
2. Type your prompt — be specific about what you need:
   - "Write a Spotify bio for [Artist Name] highlighting their last three releases"
   - "Draft a press release for [Release Title]"
   - "Suggest three promo strategies for our new signing [Artist Name]"
   - "Summarize this quarter's releases for our newsletter"
3. Click **Generate**
4. Review the output — it's saved as a draft
5. Copy, edit, or regenerate as needed

### Provider Badges

The output header shows which engine generated the text:

| Badge Color | Engine |
|-------------|--------|
| Cyan | OpenRouter (Llama 3.3 70B) |
| Emerald | Workers AI (Llama 3.1 8B) |
| Zinc | Template (no AI key configured) |
| Red | Error |

### Tips

- The more context you give, the better the output
- Artist names, release titles, and contract terms are pulled from your database — the AI has access to these
- Generate, then edit. The AI gives you a strong first draft; you add the human touch

---

## 12. Content Engine

### What Makes It Different

The **Content Engine** (`/content`) is distinct from the AI Assistant. It's purpose-built for **platform-specific content** — the AI Assistant handles general copy and strategy; the Content Engine handles channel-aware generation.

### Platform Selector

Choose a platform from the dropdown. Each platform has specific rules:

| Platform | Character Cap | Notes |
|----------|--------------|-------|
| Instagram | 220 chars | Short-form social |
| Spotify | 500 chars | Artist bio / release description |
| Beatport | 500 chars | Store description |
| TikTok | 220 chars | Short-form video caption |
| YouTube | No cap | Video description |
| SoundCloud | No cap | Track description |
| Radio | No cap | Radio one-sheet |
| Press | No cap | Full press release |
| Email | No cap | Newsletter / promo email |
| Multi-channel | Varies | Batch generation across platforms |

### Using the Content Engine

1. Navigate to **Content Engine** (`/content`)
2. Select the target **Platform**
3. Choose context: artist, release, or campaign (optional)
4. Enter your prompt or topic
5. Click **Generate**
6. The output respects the platform's character limits and style guidance

### How It Works

The platform rules are injected into the LLM system prompt AND hard-capped in the template fallback. So even without an AI key, you get properly-sized output for your chosen platform.

---

## 13. Settings

### Accessing Settings

Navigate to **Settings** (`/settings`). This is where you configure your label.

### What You Can Configure

- **Label Information** — Name, logo, contact details
- **AI Providers** — OpenRouter API key (either is optional — if neither is set, Workers AI is used)
- **Session Management** — View your current session, sign out from all devices
- **Team Access** — Manage users (admin only)

### Global Save

Settings uses **one global Save button**. Edit any card, then click the single Save at the top. This prevents the ambiguity of "which card did I just save?" — a deliberate UX choice.

### Signing Out

You can sign out from two places:
1. **User Menu** (top-right avatar chip, available on every page)
2. **Settings → Session Card**

Both clear your token and redirect to the login page. There's no "silent logout" — you always know you're signed out.

---

## 14. Security & Access

### Authentication

- Login requires username + password
- Sessions use JWT tokens (7-day expiry)
- Failed login attempts are rate-limited (5 per 15 minutes per IP)
- The system uses timing-safe password comparison to prevent username enumeration

### File Storage

- Artwork, contracts, and demo audio are stored in Cloudflare R2
- Files are served via the `/api/files/:key` endpoint
- Uploads require authentication
- Downloads can be public (for artwork/images) or authenticated (for contracts)

### Data Privacy

- Contract GDPR compliance is tracked per agreement
- IPI registration status is monitored
- No analytics or tracking beyond what's needed for the app to function

---

## 15. Quick Reference

### Status Overview

| Entity | Statuses |
|--------|----------|
| Artists | Active, Inactive, Signed, Prospect |
| Releases | Draft, Mastering, Artwork Pending, Scheduled, Released, Archived |
| Contracts | Draft, Sent, Signed, Expired, Terminated |
| Demos | New, Listening, Interested, Rejected, Accepted |
| Campaigns | Planning, Active, Completed, Paused |
| Tasks | Backlog, To Do, In Progress, Done |

### Priority Levels

| Level | Use When |
|-------|----------|
| **Critical** | Must be done today, blocking other work |
| **High** | Important, this week |
| **Medium** | Standard priority |
| **Low** | Nice to have, no urgency |

### Keyboard & Navigation

- **Click any card** to open its detail view
- **Use the sidebar** to switch between surfaces
- **Esc** closes detail panels and modals
- **Click outside** a detail panel to close it

### Getting Help

- The Dashboard's AI Recommendations suggest actions you might want to take
- The Content Engine generates copy for every platform
- Missing info flags on artists and contracts tell you what's incomplete
- Notification bell in the header shows task due dates, contract expirations, and demo reviews

---

*AURA — A&R Utility & Revenue Assistant. Built for ORBEAT Records. Ready for your label.*
