# Napoleon

A web app for playing Napoleon (the trick-taking card game) with friends
over the internet. See `napoleon-build-spec.md` for the full rules and
build spec, and `DECISIONS.md` for judgment calls made along the way.

```
packages/
  engine/     pure rules engine (no I/O, no framework)
  protocol/   wire protocol shared between server and client
  server/     Node + ws multiplayer server (rooms, seats, move validation)
  client/     Vite + React web client
  cli/        text-mode hot-seat game and a random-move bot
```

## Local development

```
pnpm install
pnpm --filter @napoleon/server dev     # starts the game server on :8080
pnpm --filter @napoleon/client dev     # starts the client on :5173
```

Open http://localhost:5173 in a few browser tabs (or separate browsers —
tabs of the *same* browser share `localStorage` and will fight over one
saved session; see DECISIONS.md #26) to try a game.

Other useful commands (run from the repo root):

```
pnpm test          # all package test suites
pnpm typecheck      # tsc --noEmit across every package
pnpm lint           # eslint across every package
pnpm --filter @napoleon/cli play               # hot-seat game in the terminal
pnpm --filter @napoleon/cli simulate 10000     # bot-vs-bot stress test
```

## Deploying

The server serves the built client itself (same origin, one process, one
port — see DECISIONS.md #30), so there's only one service to deploy.
Pick one:

### Option A: Render (no Docker)

1. Push this repo to GitHub.
2. On [render.com](https://render.com), **New +** → **Blueprint**, and point
   it at the repo. Render reads `render.yaml` at the repo root automatically
   and creates a free web service with the right build/start commands.
3. Once deployed, Render gives you a URL like `https://napoleon-xxxx.onrender.com`
   — share that with friends.

Free-tier services on Render spin down after 15 minutes of inactivity and
take a few seconds to wake back up on the next connection — fine for a
casual game night, less fine if you want it always instantly ready (in
which case upgrade the plan in `render.yaml`, or use Fly.io instead).

### Option B: Fly.io (Docker)

1. Install the [Fly CLI](https://fly.io/docs/flyctl/install/) and run
   `fly auth login`.
2. From the repo root: `fly launch` — it'll detect the `Dockerfile`, ask
   for an app name and region, and offer to write a `fly.toml`. Say **no**
   to adding a database/Redis (this app doesn't use one). Say **yes**
   when it asks to deploy now, or run `fly deploy` afterward.
3. Fly gives you a URL like `https://your-app-name.fly.dev` — share that.

Fly's free allowance covers a small always-on app like this comfortably,
though a payment method on file is required even for the free tier.

### What's NOT covered yet

Room/game state lives in server memory only — a redeploy or restart wipes
any game in progress (players would need to start a new room). That's
Phase 5's remaining gap (see `napoleon-build-spec.md` and DECISIONS.md).
Reconnecting after a dropped connection or a page refresh *within* the
same server process already works (DECISIONS.md #22, #26).
