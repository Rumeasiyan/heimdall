# Heimdall Admin Dashboard

The admin dashboard for the Network Monitoring System (issue #4).
Built with **HTMX** and **Tailwind CSS**, with **Chart.js** for the charts.
No React, no Next.js, no build step.

## Run it

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the demo login:

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

The login is a **mock** (checked in the browser only). The real login must be done by the backend.

> The dashboard must be opened through a web server (as above).
> Double-clicking `index.html` does not work, because HTMX loads the pages with requests.

No Node? `python3 -m http.server 5173` inside this folder also works.

## How it works

HTMX asks for small pieces of HTML and swaps them into the page.
Right now those pieces are static files with **mock data**.

```
login.html          Admin login page
index.html          Layout: sidebar, top bar, <main id="content">
pages/              Full pages (overview, computers, computer-1 .. computer-6, alerts)
partials/           Small pieces of HTML: tables, charts per time range (hour, day, week),
                    alert lists, alert count. Some refresh by themselves every 30 seconds
js/auth.js          Mock sign in and sign out
js/login.js         Login form behaviour
js/app.js           Active menu link, mobile menu, search and filter, error messages
js/charts.js        Turns <canvas data-chart="..."> into Chart.js charts
js/toggle-groups.js Selected look for the time range and alert filter buttons
css/style.css       A few small custom styles
```

## Connecting the real backend later

Change the `hx-get` URLs, for example `pages/computers.html` becomes `/dashboard/computers`,
and `partials/overview-stats.html` becomes `/dashboard/stats`.
The backend returns HTML for those routes. The format of each piece is in the files in `pages/` and `partials/`.
If the backend only returns JSON, agree with the backend developer how the HTML will be produced.

## Privacy

Only authorized computers and approved system and network metrics are shown.
