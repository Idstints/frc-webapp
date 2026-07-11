# Footscray Repair Cafe — web app

A repair-tracking portal for [Footscray Repair Cafe](https://www.footscrayrepaircafe.au) at Angliss
Neighbourhood House, inspired by the international
[RepairMonitor](https://www.youtube.com/watch?v=WP24o2FEmvA) system: repair request collection,
job allocation and status tracking, and a reporting/analytics dashboard.

**Live site:** https://footscray-repair-cafe.netlify.app

## What's in it

**Visitors** (people with broken things):

- Sign in with email/password or Google, choosing *Visitor* or *Volunteer* at signup
- **Book a repair** — a 4-step wizard mirroring the FRC Booking Request Google Form
  (contact details, item + category, the problem, session date & time slot)
- **Join the repair team** — the volunteer application form (skills, availability, donations)
- **My repairs** — every booking with a 4-step progress tracker
  (*Appointment confirmed → Repairer assigned → Repair in progress → Repair completed*),
  with search, status filter, and date/name sorting

**Volunteers** (the repair team) get three tabs, with a cafe switcher on top (one cafe today,
multi-cafe ready):

1. **Repair board** — toggle between *Repairs* (every booking, filterable/sortable; open one to
   confirm the appointment, assign a repairer — or yourself, start, complete, or cancel) and
   *Repairers* (searchable team roster with specialisation filters)
2. **My bench** — your volunteer profile (contact, specialisations, stats) plus the repairs
   assigned to you. Completing a repair asks: who it was done for, your name (auto-filled),
   what was wrong, what was done, whether the repair was possible, and extra notes
3. **Insights** — stat tiles (bookings, completions, fix rate, this month, team size), repairs
   per month, status and outcome breakdowns, category counts, fix rate by category, most common
   items, and CSV export

## Stack

- **Frontend:** React 19 + Vite, React Router, hand-rolled SVG charts (no chart library)
- **Backend:** Supabase — Postgres, Auth, and row-level security (project ref `eodprzymrvhdjhttqpos`, Sydney)
- **Hosting:** Netlify (site `footscray-repair-cafe`)

### Database

| Table | Purpose |
|---|---|
| `cafes` | One row per repair cafe (future multi-cafe support) |
| `profiles` | One per user, created by a trigger on signup; `role` is `visitor` or `volunteer`, volunteers carry `skills[]` |
| `repair_requests` | The whole booking-form payload + workflow state (`pending → confirmed → assigned → in_progress → completed`, or `cancelled`), timestamps per step, and the repairer's outcome (`fixed`, `partially_fixed`, `advice_given`, `not_repairable`) |
| `volunteer_applications` | Submissions from the "Join the team" form |

Row-level security: visitors can only see/create their own repairs and applications; volunteers
(via the `is_volunteer()` helper) can see and manage everything. Promote a member to the volunteer
dashboard by setting `profiles.role = 'volunteer'`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Volunteer | `volunteer@frc.demo` | `Demo1234!` |
| Visitor | `visitor@frc.demo` | `Demo1234!` |

The database is seeded with 6 volunteers, 6 visitors, and ~36 repairs across eight months of
sessions so the board and analytics have life in them.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
```

Copy `.env.example` to `.env` and fill in the Supabase URL and publishable key
(Supabase dashboard → Project Settings → API Keys).

## Deploying

Netlify builds with `npm run build` and publishes `dist/` (see `netlify.toml`, which also has the
SPA redirect). `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as Netlify build env vars.
Redeploy from the repo directory with the Netlify CLI/MCP, or connect the repo to Netlify for
deploys on push.

## One-time Supabase dashboard setup (not scriptable via API)

In the [Supabase dashboard](https://supabase.com/dashboard/project/eodprzymrvhdjhttqpos):

1. **Auth → URL Configuration** — set *Site URL* to `https://footscray-repair-cafe.netlify.app`
   and add it to *Redirect URLs* (plus `http://localhost:5173` for local dev). Without this,
   confirmation-email links and OAuth redirects point at localhost.
2. **Auth → Sign In / Up → Email** — "Confirm email" is currently **on**: new signups must click
   an emailed link before they can sign in. Either turn it off (fine for a community pilot) or set
   up custom SMTP (Auth → Emails) — the built-in mailer only sends ~2 emails/hour, which will
   rate-limit signups.
3. **Auth → Sign In / Up → Google** — to enable "Continue with Google", add OAuth credentials from
   Google Cloud Console with redirect URI
   `https://eodprzymrvhdjhttqpos.supabase.co/auth/v1/callback`. Until then the button returns an
   error and email/password works fine.
4. **Auth → Passwords** *(recommended)* — enable leaked-password protection.

## Ideas for later

- Email/SMS notifications on confirmation and completion (Supabase Edge Function + Resend/Twilio)
- A host/admin role for triaging volunteer applications from inside the app
- Weight-based landfill-diversion estimates per category on the Insights tab
- More cafes: add rows to `cafes` and the switcher in the header is already wired
