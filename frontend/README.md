# ERP Trading - frontend

React + Vite front end for the ERP Trading backend.

## Running it

The backend has to be up first; it is a separate FastAPI app in `../backend`:

```
cd ../backend && python -m uvicorn main:app --port 8000
```

Then:

```
npm install
npm run dev
```

## Configuration

One setting, `VITE_API_URL` - the base URL of the backend, no trailing slash.
See `.env.example`. Copy it to `.env.local` (git-ignored) to set it locally.

Left unset, the app calls **the host that served the page**, on port 8000. So
`http://localhost:5173` reaches `http://localhost:8000`, and there is nothing
to configure for ordinary local work.

Vite substitutes the value at **build** time rather than reading it when the
app runs, so changing it means rebuilding, and one build cannot serve two
environments.

## Reaching it from a phone

`npm run dev` binds to localhost only, so no other device can see it. To open
it from a phone on the same network:

```
npm run dev:host
```

Vite prints a `Network:` address - open that on the phone. Because the API URL
defaults to the serving host, the phone calls the backend on that same address
with no extra configuration. The backend must be listening on more than
loopback for this to work (`--host 0.0.0.0`), and its CORS policy must allow
the origin.

## Installing the mobile app

The phone app lives at `/m` and installs to the home screen. Opening the app
on a phone, or launching it once installed, lands there; **More -> Open the
desktop view** switches back for the rest of the session.

Two things it needs, both of which rule out plain HTTP on a LAN address:

- **A production build.** The service worker is registered only in production,
  because a caching worker in front of Vite's unbundled dev modules serves
  stale code after every edit. Use `npm run build && npm run preview:host`.
- **A secure context.** Browsers only register service workers over HTTPS or
  on `localhost`. Over `http://192.168.x.x` the app still runs and the figures
  are live, but it cannot be installed.

So for a real install, serve the built `dist/` over HTTPS and set
`VITE_API_URL` to the HTTPS backend before building.

## What works offline

The **shell** - the app opens from the home screen with no signal, and shows
its own screens rather than a browser error page.

The **figures do not**. The worker caches this origin's own assets and nothing
else; it deliberately does not sit between the app and the API. An earlier
version did cache API responses, and when its fetch failed for any reason every
screen reported "No connection" while the network and backend were both fine -
too much to risk on the one path the app cannot do without.

Offline figures, if they are wanted, belong in the app rather than the worker,
where a failure degrades to visibly stale data instead of a fabricated error.
`useLiveData` already carries the `stale` flag and the age for exactly that.
