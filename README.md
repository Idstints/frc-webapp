# Footscray Repair Cafe — web app

Repair booking and tracking for [Footscray Repair Cafe](https://www.footscrayrepaircafe.au) at
Angliss Neighbourhood House. Visitors book a repair and follow its progress; the team allocates
jobs, records outcomes and sees the numbers.

**We host this ourselves.** One laptop runs the website, the database, sign-in and photo storage.
No Netlify, no hosted Supabase, no cloud service holding visitors' names and phone numbers.

| | |
|---|---|
| **Server** | A MacBook running Linux Mint |
| **You need** | Docker and the Supabase CLI — the installer sets both up |
| **Time** | About 30 minutes, most of it downloading |
| **Also runs on** | Windows and macOS, for testing |

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Install it](#2-install-it)
3. [After installing](#3-after-installing)
4. [Putting it on the internet](#4-putting-it-on-the-internet)
5. [Accounts and signing in](#5-accounts-and-signing-in)
6. [Running it day to day](#6-running-it-day-to-day)
7. [Keeping it alive](#7-keeping-it-alive)
8. [What's in the app](#8-whats-in-the-app)
9. [Changing the app](#9-changing-the-app)
10. [When something's wrong](#10-when-somethings-wrong)
11. [Known gaps](#11-known-gaps)

For the technical picture — services, ports, trust model — see **[RUNTIME.md](RUNTIME.md)**.

---

## 1. Before you start

### The machine

A laptop that can stay switched on, plugged in and connected. It doesn't need to be powerful:
4 GB of free RAM and 20 GB of disk is plenty. It does need to be a machine nobody will close the
lid on and walk away with — while it's off, the website is down.

### What gets installed

Only two things, and the installer handles both:

- **Docker** — runs everything in containers
- **Supabase CLI** — sets up the database and keeps it in step with the code

You do **not** need Node, Caddy, Postgres or a web server. Those either run in containers or
aren't needed.

### Decide these first

| Question | Notes |
|---|---|
| **Who owns the machine?** | It holds every visitor record. It should not be someone's personal laptop that leaves the building. |
| **Who else can administer it?** | At least two people, or you have a single point of failure. |
| **Where do backups go?** | A USB drive kept somewhere else. Decide before you have data to lose. |
| **Google sign-in?** | Optional and **off by default**. Email/password works without it. Turning it on needs a Google Cloud account — see [section 5](#5-accounts-and-signing-in). |

### You do not need a Supabase account

This trips people up. Supabase is open-source software, and we run our own copy. There is no
supabase.com login, no dashboard, no project, nothing to pay for and nothing that can expire.
[Section 5](#5-accounts-and-signing-in) explains what replaces it.

---

## 2. Install it

Open a terminal and run these three commands in order.

**Install Docker and the Supabase CLI:**

```bash
./scripts/install-prereqs.sh
```

> **On Linux, log out and back in afterwards.** The installer adds you to the `docker` group, and
> Linux only applies group changes to a new login session. Skip this and the next step fails.

**Get the code:**

```bash
git clone https://github.com/Idstints/frc-webapp.git && cd frc-webapp
```

**Set everything up:**

```bash
./scripts/bootstrap.sh
```

That downloads the container images, starts the database, builds it from `supabase/migrations/`,
compiles the website and starts the web server. First run takes a while — it's downloading several
GB. After that it's seconds.

When it finishes, the site is at **http://localhost:8080** with an empty database.

---

## 3. After installing

**Check it works.** Run the acceptance test:

```bash
./scripts/smoke-test.sh
```

It checks about 25 things end to end — that API requests reach the database rather than being
answered with the HTML page, that row-level security is on for every table, that the ticket
endpoint is deployed, that the built JavaScript contains the right address. It exits non-zero if
anything fails, so it is also the thing to run before a cafe day.

Then open <http://localhost:8080>. You should see the Repair Cafe home page.

**Create your account** in the app — use the normal sign-up.

**Make yourself a repairer.** New volunteer accounts start unapproved and see nothing until an
existing repairer approves them. The first one has nobody to do that, so:

```bash
./scripts/make-volunteer.sh you@example.com
```

Sign out and back in. You should now see the Repair board. From here on, approvals happen inside
the app — *Repair board → Repairers* — and this script is never needed again.

**Take a backup, and restore it.** Before there's anything to lose, prove the process works:

```bash
./scripts/backup.sh
```

The script refuses to report success on a dump it can't read back, and prints the exact commands
to test a restore. Do that once, now.

---

## 4. Putting it on the internet

Everything so far only works on the machine itself. `localhost` means "this computer" — visitors
at home cannot reach it, and neither can a phone on the same wifi.

Start local, confirm it works, then go public. To see how:

```bash
./scripts/set-public-url.sh
```

With no arguments it prints the whole procedure. In short:

**1. Install Tailscale** — this gives you a real HTTPS address without opening a port on the
router or paying for a fixed IP.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

**2. Sign in:**

```bash
sudo tailscale up
```

**3. Publish port 8080, and only 8080:**

```bash
sudo tailscale funnel --bg 8080
```

It prints an address like `https://frc-server.tailXXXX.ts.net`.

**4. Tell the app its address:**

```bash
./scripts/set-public-url.sh https://frc-server.tailXXXX.ts.net
```

This step matters more than it looks. The address lives in two files that must agree, and one of
them is compiled into the JavaScript — so changing it by hand and not rebuilding leaves a site
that loads but can't sign anyone in. The script does both and restarts everything.

To check what's published: `sudo tailscale funnel status`
To take it offline: `sudo tailscale funnel --bg off`
To go back to local-only: `./scripts/set-public-url.sh --local`

> **Why Tailscale rather than Cloudflare.** Funnel passes encrypted traffic through to this machine
> and lets it do the decrypting, so visitors' names and phone numbers are never readable by anyone
> in between. Cloudflare Tunnel decrypts on their servers. Both work; only one matches the reason
> we stopped using a cloud database.

A bought domain name is optional and can wait. The free `.ts.net` address works and costs nothing.

---

## 5. Accounts and signing in

There are three separate things people call "accounts" here. They are unrelated, and mixing them
up causes most of the confusion.

### The Supabase account — there isn't one

On the old hosted setup, the database lived in a Supabase project tied to a supabase.com login.
**Self-hosted, that's gone entirely.** Nobody signs in to Supabase. There's no project, no billing,
no dashboard, and nothing to renew.

What replaces the dashboard is **Studio**, a local admin console at <http://localhost:54323>. Two
things to know about it:

- It has **no password at all**. Anyone who can reach that port can read and change every visitor
  record.
- It is therefore bound to this machine only, and deliberately **not** published through the
  tunnel. Never add it.

### Team accounts — created in the app

Volunteers sign up through the website like anyone else. A new volunteer account is **unapproved**
and sees nothing — row-level security hides all visitor data until an existing repairer approves
them in *Repair board → Repairers*.

The one exception is the first account, which uses `./scripts/make-volunteer.sh` (see
[section 3](#3-after-installing)).

**Accounts from the old hosted site do not come across.** The team signs up again, once. This is
deliberate: the old database was a test bed, and starting clean means no invented test people end
up in the Repair Cafe's permanent records.

### Visitor access — no accounts at all

Visitors never create a password or confirm an email. They get an eight-character ticket like
`482137-KM`; entering it opens their record. Behind the scenes the system does make a hidden
account for them so the same security rules apply, but they never see it.

Treat a full ticket as a password — it opens that person's whole history. The six-digit half alone
does not.

### Google sign-in — optional, off by default

A fresh install has Google sign-in **disabled**, so there's nothing to configure and email/password
works immediately. To switch it on:

1. Create an OAuth client at [console.cloud.google.com](https://console.cloud.google.com).
2. Add `<your-public-url>/auth/v1/callback` to its authorised redirect URIs.
3. Put the client ID and secret into `supabase/.env`.
4. Set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`.
5. Restart: `./scripts/stop.sh && ./scripts/start.sh`

If you change the site's address later, add the new callback URL too — otherwise Google sign-in
fails with `redirect_uri_mismatch`.

---

## 6. Running it day to day

| Command | What it does |
|---|---|
| `./scripts/start.sh` | Bring everything up |
| `./scripts/stop.sh` | Shut down — records are kept |
| `./scripts/smoke-test.sh` | Check the whole install actually works |
| `./scripts/backup.sh` | Back up every record, and verify the backup |
| `./scripts/build.sh` | Recompile the website after a code change |
| `./scripts/set-public-url.sh` | Show how to get online, or set the address |
| `./scripts/make-volunteer.sh` | Approve the very first repairer |
| `./scripts/install-autostart.sh` | Start automatically after a reboot |
| `npm run status` | What's running |
| `npm run logs` | Follow the web server log |

---

## 7. Keeping it alive

### Start after a reboot

```bash
./scripts/install-autostart.sh
```

On Linux this installs a systemd service that starts at boot, with no need for anyone to log in.

### Stop it going to sleep

A suspended laptop is an offline website. The script prints the exact settings but does not change
them for you — it alters how the whole machine behaves, so it should be your decision. On Mint
there are two separate settings: lid-close behaviour, and idle suspend.

### Backups

Nobody else is doing this now.

```bash
./scripts/backup.sh /media/usb/frc-backups
```

Run it after every cafe day, to a drive that is not this laptop. A backup nobody has restored is a
guess, not a backup.

---

## 8. What's in the app

**Visitors** — people with broken things:

- **A ticket instead of an account** — eight characters, no password, no email confirmation. Lost
  the card? A name plus two other matching details also works.
- **Book a repair** — a four-step wizard: contact details, item and category, the problem, then a
  live slot picker for upcoming session Saturdays (half-hour slots, three repairs each, showing
  availability without revealing anyone else's booking). Up to three photos per item.
- **Follow the job** — progress from *appointment confirmed* to *completed*, plus a message thread
  with the team that carries across repeat visits for the same item.

**The team** — three tabs:

1. **Repair board** — every booking, filterable and sortable; confirm, assign, start, complete or
   cancel. Also the roster, where new repairers are approved.
2. **My bench** — your profile and your assigned repairs. Completing one records what was wrong,
   what was done, and the outcome.
3. **Insights** — bookings, completions, fix rate, repairs per month, category breakdowns, most
   common items, CSV export.

### Database

| Table | Purpose |
|---|---|
| `cafes` | One row per repair cafe (multi-cafe ready) |
| `profiles` | One per person; `person_code` is the six-digit half of their ticket |
| `repair_requests` | The booking, its workflow state, and the outcome. `job_code` is the full ticket; repeat visits for one item share it |
| `repair_messages` | The conversation, threaded on `job_code` |
| `volunteer_applications` | "Join the team" submissions |
| `ticket_attempts` | Rate limiting for ticket entry |

`supabase/migrations/` is the source of truth. Never change the database by hand — add a migration.

---

## 9. Changing the app

```bash
# edit src/…
./scripts/build.sh
```

Refresh the browser. For faster work, `npm run dev` on <http://localhost:5173> gives hot reload
against the same database (needs Node installed).

Schema changes go through a migration, never Studio:

```bash
supabase migration new describe_the_change
```

Write the SQL in the file it creates, then `supabase migration up`.

---

## 10. When something's wrong

| Symptom | Cause |
|---|---|
| Nothing loads at all | Docker isn't running — `sudo systemctl start docker` |
| `permission denied` on the Docker socket | You're not in the `docker` group, or you haven't logged out and back in since being added |
| Site loads, sign-in fails | The two addresses disagree — re-run `./scripts/set-public-url.sh` |
| Changed `.env`, nothing happened | It's compiled in. Run `./scripts/build.sh` |
| `redirect_uri_mismatch` on Google | The public address isn't in the Google OAuth client's redirect list |
| Works locally, not from outside | The tunnel isn't running — `sudo tailscale funnel --bg 8080` |
| Refreshing a page gives 404 | Caddy isn't serving `index.html` for unknown paths |
| Site down after a reboot | Autostart isn't installed, or the machine slept |

`npm run logs` and `journalctl -u frc-webapp -f` are where the answers usually are.

### Platform support

| Platform | Status |
|---|---|
| **Linux Mint / Ubuntu / Debian** | The real target. Everything works, including autostart. |
| **Windows** | Testing only. Needs Docker Desktop with WSL 2; run the scripts from Git Bash. No autostart. |
| **macOS** | Testing only. Autostart is login-based rather than boot-based. |

---

## 11. Known gaps

Honest list of what this does not do:

- **Nothing sends email or SMS.** Not a setting — it was never built. Visitors aren't told when a
  booking is confirmed, and nobody is notified of a message. Someone has to open the app to see it.
- **One repair per person per month isn't enforced**, and volunteers can't log walk-ins.
- **The machine is a single point of failure.** One laptop, one disk. Backups are the whole of the
  mitigation.
- **The old hosted setup is still there** as a fallback until this one has run a few cafe days
  without incident. `netlify.toml` is kept for that and does nothing here. Retiring it should be a
  decision, not an oversight.
