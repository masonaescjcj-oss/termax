# Termax Admin Console

The admin panel, as its own site. It is not part of the Termax app: it is a
separate build, deployed to its own address, that talks to the same backend
over `/api/v1/admin/*`.

It used to be a screen inside the mobile app. That meant every user shipped
a moderation surface they could never open, admin work needed a phone, and
the console's chrome had to fight the app's theme. Splitting it out fixes
all three, and the app is smaller for it.

## What it does

| Section | |
|---|---|
| **Dashboard** | The six platform counts, and the last few admin actions. |
| **Audit log** | Who changed what, when, with the before/after. Filterable by action. |
| **Users** | Search and page through accounts; change role and plan inline; open one account. |
| **User detail** | Trading record, accounts and balances, bots, open positions. Suspend or restore an account; set a demo balance; force-close a position. |
| **Positions** | Every open position on the platform with its live floating P/L, filterable by symbol; force-close any simulated one. |
| **Brokers** | Full CRUD with logo upload, including the deactivated ones and a restore. |
| **Communities** | CRUD, plus assigning an admin or moderator by username or email. |
| **Promoted symbols** | CRUD, pin/unpin, optional high/low/change metrics. |
| **Reviews** | Pending, approved or all; approve or delete. |
| **Campaigns** | CRUD with a task editor that knows each task type's settings. |
| **Reward animations** | Upload and delete the Lottie files campaigns hand out. |
| **AI provider** | Primary and fallback provider, model and keys. |

## Running it

```bash
npm install
cp .env.example .env      # point VITE_API_URL at your backend
npm run dev               # http://localhost:5174
```

In development Vite proxies `/api` to `VITE_API_URL`, so there is no CORS to
configure. In production set `VITE_API_URL` to the backend's public origin, or
leave it blank if the console and the backend sit behind the same domain.

```bash
npm run build             # -> dist/, a static bundle
```

`dist/` is plain static files: any static host will do. The only requirement
is a **SPA fallback** — unknown paths must serve `index.html`, or a refresh on
`/users/abc` will 404.

## Signing in

Any account whose `role` is `admin` in `public.users`. A non-admin is told so
at the login screen rather than being let in to a wall of 403s. There is no
separate admin password: it is the same Supabase account the app uses.

To make the first admin, run `backend/src/scripts/createAdmin.ts`, or set
`role = 'admin'` on the row directly.

## Before the audit log works

Run `backend/src/scripts/migrations/013_admin_audit.sql` on Supabase. Until
then the audit page says so plainly and everything else works — nothing
depends on it except the log itself.

## Notes for whoever works on this next

- **Everything goes through `src/api.ts`.** It attaches the token, turns a
  401 into a real sign-out, and converts failures into an `ApiError` carrying
  the server's own message. Nothing should call `fetch` directly.
- **`useLoader` keeps the three states a page really has** — loading, failed
  with a reason and a retry, loaded. A page that renders an empty table when
  the request actually failed is the bug it exists to prevent.
- **Destructive actions confirm first**, through `confirmDestructive`.
- **Keys are never sent to the browser.** The AI config endpoint reports
  whether a key is stored, never its value, and a blank field on save keeps
  what is stored.
