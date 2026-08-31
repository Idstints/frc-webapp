# Footscray Repair Cafe — web app

A repair-tracking portal for [Footscray Repair Cafe](https://www.footscrayrepaircafe.au) at Angliss
Neighbourhood House, inspired by the international
[RepairMonitor](https://www.youtube.com/watch?v=WP24o2FEmvA) system: repair request collection,
job allocation and status tracking, and a reporting dashboard.

**This runs on our own hardware.** One Mac hosts the site, the database, sign-in and photo
storage — no Netlify, no hosted Supabase, no cloud account holding visitors' details. Everything
below is about getting that Mac serving.

- [RUNTIME.md](RUNTIME.md) — what runs on which port, and what must never be exposed
- Setup on a fresh machine — the next section

## Getting it running

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the Supabase CLI.
Nothing else — not even Node.

```bash
brew install --cask docker
brew install supabase/tap/supabase
```

Open Docker Desktop once and let it finish setting itself up. Then:

```bash
git clone https://github.com/Idstints/frc-webapp.git
cd frc-webapp
./scripts/bootstrap.sh
```

That pulls the container images, starts Postgres and the rest of the stack, builds the database
from `supabase/migrations/`, compiles the front end and starts the web server. First run takes a
few minutes; after that it's seconds.

When it finishes the site is at **http://localhost:8080** with an empty database.

Sign up in the app, then make yourself a repairer — the first one has nobody to approve them:

```bash
./scripts/make-volunteer.sh you@example.com
```

From then on, approvals happen inside the app (*Repair board → Repairers*).

## Putting it on the internet

`localhost` only works on the Mac itself. To let people book from home you need a tunnel, which
gives you a public HTTPS address without opening a port on the router.

```bash
brew install --cask tailscale
```

Sign in to Tailscale, then expose the one port that should ever be public:

```bash
sudo tailscale funnel --bg 8080
```

It prints an address like `https://frc-mac.tailXXXX.ts.net`. Tell the app about it:

```bash
./scripts/set-public-url.sh https://frc-mac.tailXXXX.ts.net
```

That script exists because the address lives in two places that must agree, and one of them is
compiled into the JavaScript. Setting it by hand is the most common way to break sign-in.

> **Why Tailscale rather than Cloudflare.** Funnel hands the encrypted traffic to the Mac and lets
> it do the decrypting, so visitor names and phone numbers are never readable in transit by anyone
> else. Cloudflare Tunnel decrypts and re-encrypts on their servers. Both work; only one of them
> matches the reason we stopped using a cloud database.

## Day to day

| Command | What it does |
|---|---|
| `./scripts/start.sh` | Bring everything up |
| `./scripts/stop.sh` | Shut everything down — records are kept |
| `./scripts/backup.sh` | Dump every record to `~/frc-backups`, and verify the dump |
| `./scripts/build.sh` | Recompile the front end after a code change |
| `./scripts/install-autostart.sh` | Start automatically at login |
| `npm run status` | What's running |
| `npm run logs` | Follow the web server log |

### Keeping it up

A laptop that sleeps is a website that's down. `./scripts/install-autostart.sh` sets up a login
agent that waits for Docker and starts everything, and tells you the two things it deliberately
won't do for you: disable sleep, and enable automatic login.

### Backups

Nobody else is doing this now.

```bash
./scripts/backup.sh /Volumes/YourBackupDrive
```

Run it after every cafe day, to a drive that is not this Mac. The script refuses to report success
on a dump it can't read back, but that is not the same as a tested restore — do one of those,
once, before you rely on any of it.

## What's in the app

**Visitors** — people with broken things:

- **A ticket instead of an account.** A visitor gets an eight-character number like `482137-KM`:
  six digits identify them, two letters identify the item. Entering it opens their record. No
  password, no email confirmation. Lost the card? Name plus two other matching details also works.
- **Book a repair** — a four-step wizard mirroring the paper form: contact details, item and
  category, the problem, then a live slot picker for upcoming session Saturdays (half-hour slots,
  three repairs each, availability counted without revealing anyone else's booking). Up to three
  photos per item so repairers can see it beforehand.
- **Follow the job** — a progress tracker from *appointment confirmed* through to *completed*,
  and a message thread with the team that carries across repeat visits for the same item.

**Volunteers** — the repair team, in three tabs:

1. **Repair board** — every booking, filterable and sortable; open one to confirm, assign a
   repairer, start, complete or cancel. Also the team roster, where new repairers are approved.
2. **My bench** — your profile and the repairs assigned to you. Completing one records what was
   wrong, what was done, and the outcome.
3. **Insights** — bookings, completions, fix rate, repairs per month, category breakdowns, most
   common items, and CSV export.

New volunteer accounts start unapproved and see nothing until an existing repairer approves them —
row-level security hides all visitor data from them until then.

### Database

| Table | Purpose |
|---|---|
| `cafes` | One row per repair cafe (multi-cafe ready) |
| `profiles` | One per person; `role` is `visitor` or `volunteer`, and `person_code` is the six-digit half of their ticket |
| `repair_requests` | The booking, the workflow state, and the repairer's outcome. `job_code` is the full ticket; repeat visits for one item share it |
| `repair_messages` | The conversation, threaded on `job_code` |
| `volunteer_applications` | "Join the team" submissions |
| `ticket_attempts` | Rate limiting for ticket entry |

The schema lives in `supabase/migrations/` and is the source of truth — `supabase db reset`
rebuilds the whole database from it. Never change the database by hand; add a migration.

## Changing the app

```bash
# edit src/…
./scripts/build.sh
```

The browser picks it up on refresh. For faster iteration, `npm run dev` on
<http://localhost:5173> talks to the same stack with hot reload (needs Node installed).

Schema changes go through a migration, never the admin console:

```bash
supabase migration new describe_the_change
# write the SQL in the file it creates
supabase migration up
```

## When something's wrong

| Symptom | Cause |
|---|---|
| Nothing loads at all | Docker Desktop isn't running |
| Site loads, sign-in fails | `VITE_SUPABASE_URL` and `FRC_SITE_URL` disagree — re-run `set-public-url.sh` |
| Changed `.env`, nothing happened | It's compiled in. Run `./scripts/build.sh` |
| `redirect_uri_mismatch` on Google | The public URL isn't in the Google OAuth client's redirect list |
| Works locally, not from outside | The tunnel isn't running: `sudo tailscale funnel --bg 8080` |
| Reachable but wrong page on refresh | Caddy isn't serving `index.html` for unknown paths |

`npm run logs` and `~/Library/Logs/frc-autostart.log` are where the answers usually are.

## The cloud fallback

The original hosted setup (Netlify plus Supabase cloud) still exists and is kept until this one
has run a few cafe days without incident. `netlify.toml` is retained for that reason only and does
nothing here. Retiring it is a decision, not an oversight — make it deliberately.

## Known gaps

- **Nothing sends email or SMS.** Not a configuration problem: it was never built. Visitors aren't
  told when a booking is confirmed, and nobody is notified of a message. Someone has to open the
  app to see it.
- **One repair per person per month isn't enforced**, and walk-ins can't be logged by volunteers.
- **The Mac is a single point of failure.** One disk, one machine, one power outlet. Backups are
  the whole of the mitigation.
