<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/logo-enscon-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="docs/logo-enscon-light.svg" />
  <img src="docs/logo-enscon-light.svg" alt="ENSCON 旅程 / ENSCON Trip" height="96" />
</picture>

<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/subtitle-light.png" />
  <source media="(prefers-color-scheme: light)" srcset="docs/subtitle-dark.png" />
  <img src="docs/subtitle-dark.png" alt="your trip. your plan." height="28" />
</picture>

ENSCON 旅程（ENSCON Trip）是 [TREK](https://github.com/liketrek/TREK)（作者 Maurice Boe，[github.com/mauriceboe/TREK](https://github.com/mauriceboe/TREK)）的分支，依 AGPL-3.0 釋出；我們的修改都在本 repo。
<br />
ENSCON Trip is a fork of [TREK](https://github.com/liketrek/TREK) by Maurice Boe, released under AGPL-3.0; all our changes are in this repository.

A self-hosted, real-time collaborative travel planner — with maps, budgets, packing lists, a journal, and AI built in.

<br />

<a href="https://github.com/JoeyVIP/enscon-trip/actions/workflows/test.yml"><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/JoeyVIP/enscon-trip/test.yml?branch=main&style=for-the-badge" /></a>
&nbsp;
<a href="https://github.com/JoeyVIP/enscon-trip/pkgs/container/enscon-trip"><img alt="Container image" src="https://img.shields.io/badge/ghcr.io-joeyvip%2Fenscon--trip-2496ED?style=for-the-badge" /></a>
<br />
<a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square" /></a>
</div>

---


## What you get

<picture>
  <source media="(max-width: 700px)" srcset="docs/tiles/grid-mobile.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="docs/tiles/grid-desktop-dark.svg" />
  <img src="docs/tiles/grid-desktop.svg" alt="Plan, track, share" width="100%" />
</picture>

<details>
<summary><b>See all features</b></summary>

<br />

Most of what follows is an addon an admin switches on or off. Lists, Costs, Documents, Collab, Vacay and Atlas ship on; Journey, Collections, MCP, AI Parsing and AirTrail ship off and are marked below.

<table>
<tr>
<td width="50%" valign="top">

#### 🧭 Planning

- **Day plans**: drag places between days and reorder inside a day, with undo. Notes and bookings drag the same way, and a map marker drops straight onto a day
- **Maps**: Leaflet, Mapbox GL or MapLibre GL (OpenFreeMap, no token), with clustering, photo markers and route lines. 3D buildings and terrain are Mapbox only
- **Place search**: Google Places when a key is set (photos, ratings, opening hours), otherwise OpenStreetMap with no key
- **Place enrichment**: descriptions, facts, hours and photo candidates from OpenStreetMap, Wikipedia, Wikidata and Wikimedia Commons
- **POI explore**: pull OpenStreetMap POIs by category for the current viewport over Overpass
- **Import**: shared Google Maps and Naver Maps lists, plus GPX, KML and KMZ files
- **Export**: GPX of a trip's places and tracks, and an ICS feed per trip or across all of them
- **Routes**: auto-sort a day (nearest neighbour then 2-opt, locked stops and hotel anchors stay put), driving, walking or cycling profiles over OSRM, then open it in Google Maps or CoMaps
- **Public transport**: door-to-door itineraries over Transitous
- **Weather**: 16-day forecast from Open-Meteo, no key. Dates outside that window read the archive for the same date instead
- **Day notes**: markdown body with an icon and a colour, reordered by drag and drop or moved to another day
- **Trip dates**: move a trip and the days re-date themselves, either dragging the bookings along or re-anchoring them. Trips also copy and archive

</td>
<td width="50%" valign="top">

#### 🧳 Bookings and money

- **Reservations**: 16 booking types with status, confirmation code, travellers and attached files
- **Flights and trains**: several legs with stopovers, per-leg times and endpoint timezones, against 4,045 bundled airports so local times resolve without a key
- **Accommodation**: a stay spans a range of days with a check-in window, and shows on every night it covers
- **Booking import**: EML, PDF, PKPass, HTML and TXT confirmations through [KItinerary](https://invent.kde.org/pim/kitinerary). Needs the `kitinerary-extractor` binary, which ships in the Docker image
- **AirTrail** (off by default): link a self-hosted AirTrail instance to import flights as reservations and keep them in sync
- **Costs**: split expenses in integer cents with equal or custom shares, several payers per expense, settle-up suggestions, a settlement log, and CSV export
- **Currencies**: a currency per expense with the rate frozen at entry. Rates come from Frankfurter, no key
- **Packing lists**: categories, admin-managed templates, assignees, three visibility tiers, and a packed-of-total line. Bags with weight roll-up are a separate admin switch, off by default
- **To-dos**: assignee, due date, priority, and a reminder before one falls due
- **Files**: attach to a trip, place, day entry or reservation. 50 MB each, 500 MB for video, with trash and restore
- **PDF export**: cover page, place photos, day notes, bookings and costs, with an optional page break per day

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 👥 Collaboration

- **Real-time sync** (WebSocket): edits land live for everyone who has that trip open
- **Members**: add by email or username, hand ownership to someone else, or add guests who have no login at all
- **Permissions**: an admin maps each of 16 trip actions to admin, trip owner, trip member or everybody
- **Invite links**: one reusable link per trip with an optional expiry. Admins can also issue signup invites with a use limit that drop the new account straight into a trip
- **Public share**: a read-only trip page anyone can open without an account
- **Collab**: group chat with replies, reactions and link previews, shared notes with attachments, polls, and a What's Next list of upcoming activities. Each of the four switches on its own

#### 📔 Journal, Atlas and Vacay

- **Journey** (off by default): dated entries with story, mood, weather and tags, photos and video from uploads or a linked [Immich](https://immich.app) or Synology Photos library, map views, co-authors, and a public share link
- **Atlas**: mark countries and sub-national regions visited on [geoBoundaries](https://www.geoboundaries.org/) outlines, plus a bucket list, travel stats and a consecutive-years-travelled count
- **Vacay**: leave calendar with half days, public holidays from date.nager.at, school holiday overlays for 16 European countries, carry-over between years, and joint or read-only sharing of a plan
- **Collections** (off by default): a place library outside any trip, with labels, ratings, a custom image per place, copy-into-a-trip, and sharing by invite

</td>
<td width="50%" valign="top">

#### 🧩 Plugins

- **Third-party plugins**: install from the ENSCON Trip registry or sideload a zip, switch on per instance, with their own pages under `/plugins/<id>`
- **Sandboxed**: one child process per plugin, 63 grantable permissions, an admin-edited outbound host allowlist, memory and RPC caps, and daily caps on AI and notification calls
- **Trust**: registry downloads are pinned by sha256 and checked against the author's minisign key. A sideloaded zip is marked unverified, and `TREK_PLUGINS_ENABLED=false` turns the whole system off
- **Extension points**: map markers and layers, place details, day schedules, PDF sections, Atlas layers, journal rows, trip warnings, calendar sources, route profiles and notification channels. Plugin pages run in an opaque-origin iframe
- **SDK**: [`trek-plugin-sdk`](https://www.npmjs.com/package/trek-plugin-sdk) on npm, with a manifest validator, a mock host, and a dev-link mode that runs a local build against real data

#### 🤖 AI and MCP

- **MCP server** (off by default): OAuth 2.1 with mandatory PKCE and dynamic client registration. 199 tools, 30 resources, 4 prompts
- **Scopes**: 29 scopes in 14 groups, each one tickable on the consent screen. Tokens are bound to the `/mcp` resource, and every tool call lands in the audit log
- **Reach**: create trips and days, edit places, packing lists, to-dos, costs, reservations, collections and journeys, mark countries visited, all inside the scopes the token holds
- **Prompts**: `trip-summary`, plus `packing-list` and `budget-overview` when those addons are on
- **Addon-aware**: seven addon gates decide which tools and resources a session sees. Flipping one drops live sessions so the surface re-registers
- **Booking extraction** (off by default): read a confirmation with a local Ollama server, any OpenAI-compatible endpoint, or Anthropic, configured instance-wide or per user

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 📱 Mobile and offline

- **Installable**: iOS and Android straight from the browser, no App Store. Runs standalone without browser chrome, with the status bar tinted per theme
- **Phone layouts**: a separate shell below 768px with its own tokens, a bottom bar and safe-area insets. Which items sit in that bar is up to the user
- **Offline reads**: the app shell and every route chunk are precached, and trips, places and file blobs live in a per-user IndexedDB store, so a trip opens with no network
- **Offline writes**: mutations queue and replay with an `X-Idempotency-Key`, so a reconnect cannot double-apply. A stale edit is parked for a keep-mine or keep-theirs choice
- **Offline maps**: pre-download a trip's raster tiles, and clear them again
- **API responses are never cached** by the service worker. They vary per session, so they always come from the network

</td>
<td width="50%" valign="top">

#### ⚙️ Admin, accounts and security

- **Login methods**: password login, password registration, OIDC login, OIDC registration and passkey login each switch on and off on their own. `OIDC_ONLY` leaves SSO as the only way in
- **SSO (OIDC)**: one provider by discovery, with PKCE and `id_token` verification (Authentik, Keycloak, Google and the like)
- **2FA**: TOTP with ten single-use backup codes, and an admin can require it instance-wide
- **Passkeys**: WebAuthn login by fingerprint, face, PIN or security key, off until an admin enables it. A passkey also satisfies the 2FA requirement
- **Hardening**: per-IP limits on login, password reset and 2FA attempts, a password policy, secrets encrypted at rest and masked on read, and an SSRF guard on every URL you configure
- **Admin panel**: users and invites, the permission matrix, packing templates, categories, addons, plugins, API keys, MCP tokens and OAuth sessions, backups, storage, audit log, and GitHub releases
- **Backups**: manual or scheduled hourly, daily, weekly or monthly, with retention in days. The zip carries the at-rest key, so a restore can decrypt its own secrets
- **Storage**: pluggable storage backends per content category — keep everything on local disk, or add S3-compatible backends and replicate any category to them, configured entirely from the admin panel
- **Notifications**: a per-user matrix of events against in-app, email (SMTP), webhook and ntfy, plus any channel a plugin registers
- **Appearance**: light, dark or follow the OS, seven colour schemes plus a custom accent, transparency, compact density, reduce motion, and text size per tier
- **23 languages**: en, de, es, fr, it, nl, hu, ru, zh, zh-TW, pl, cs, ar (right to left), br, id, tr, ja, ko, uk, gr, sv, vi, ca
- **In-app help**: the wiki ships inside the image and is served from disk at `/help`, so the docs match the version you are running

</td>
</tr>
</table>

</details>

<br />


## AI usage

We use LLM-assisted coding tools across parts of this codebase. Nothing ships that a
maintainer has not read and understood: every change goes through a pull request, is
reviewed and tested, and has a human who can answer for it. "The AI wrote that" is not
an answer any of us would accept from ourselves.

See [**How we use AI in TREK**](https://github.com/liketrek/TREK/discussions/1851) for
the details.

<br />

## Get started in 30 seconds

```bash
ENCRYPTION_KEY=$(openssl rand -hex 32) docker run -d -p 3000:3000 \
  -e ENCRYPTION_KEY=$ENCRYPTION_KEY \
  -v ./data:/app/data -v ./uploads:/app/uploads ghcr.io/joeyvip/enscon-trip
```

Open `http://localhost:3000`. On first boot ENSCON Trip seeds an admin account — if you set `ADMIN_EMAIL`/`ADMIN_PASSWORD` those are used, otherwise the credentials are printed to the container log (`docker logs trek`).

<div align="center">

<a href="#docker-compose-production">Docker Compose</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#helm-kubernetes">Helm / Kubernetes</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#install-as-app-pwa">Install as PWA</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#reverse-proxy">Reverse Proxy</a>

</div>

<br />

## Tech stack

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js_22-339933?style=flat-square&logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS_11-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

Real-time sync via WebSocket (`ws`). Backend on NestJS 11. State with Zustand. Auth via JWT + OAuth 2.1 + OIDC + Passkeys (WebAuthn) + TOTP MFA. Weather via Open-Meteo (no key required). Maps with Leaflet and Mapbox GL.

<br />

<h2 id="docker-compose-production">Docker Compose (production)</h2>

The repository ships a ready-to-use [`docker-compose.yml`](docker-compose.yml)
with secure defaults and every option documented inline. Download it, then:

```bash
docker compose up -d
```

See [Install with Docker Compose — 上游 TREK 文件 (upstream docs)](https://github.com/liketrek/TREK/wiki/Install-Docker-Compose)
for the full walkthrough.

<br />

<h2 id="helm-kubernetes">Helm (Kubernetes)</h2>

> Helm chart 目前沿用上游 TREK 的，尚未提供我們自己的。
> The Helm chart is currently upstream TREK's; we do not publish our own yet.

```bash
helm repo add trek https://chart.liketrek.com
helm repo update
helm install trek trek/trek
```

See [`charts/README.md`](https://github.com/liketrek/TREK/blob/main/charts/README.md) for values.

<br />

<h2 id="install-as-app-pwa">Install as App (PWA)</h2>

ENSCON Trip works as a Progressive Web App — no App Store needed.

1. Open ENSCON Trip in the browser (HTTPS required)
2. **iOS**: Share ▸ *Add to Home Screen*
3. **Android**: Menu ▸ *Install app* (or *Add to Home Screen*)

ENSCON Trip then launches fullscreen with its own icon, just like a native app.

<br />

## Updating

See [Updating — 上游 TREK 文件 (upstream docs)](https://github.com/liketrek/TREK/wiki/Updating) — Docker Compose,
Docker run, Helm, Portainer, Unraid and Proxmox, plus the encryption-key note.

<br />

<h2 id="reverse-proxy">Reverse Proxy</h2>

For production, put ENSCON Trip behind a TLS-terminating reverse proxy. ENSCON Trip uses WebSockets for real-time sync, so the proxy **must** support WebSocket upgrades on `/ws`.

If you use the MCP addon, the proxy must also pass the `Mcp-Session-Id` header through in both directions on `/mcp` — Nginx and Caddy do this by default, but a proxy that strips it makes every tool call open a new session instead of reusing one. See the [Reverse Proxy wiki page](https://github.com/liketrek/TREK/wiki/Reverse-Proxy) for details.

<details>
<summary>Nginx</summary>

```nginx
server {
    listen 80;
    server_name trek.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trek.yourdomain.com;

    ssl_certificate     /etc/ssl/fullchain.pem;
    ssl_certificate_key /etc/ssl/privkey.pem;

    # 500 MB covers backup-restore uploads (capped at 500 MB server-side).
    client_max_body_size 500m;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Only needed if you use the MCP addon. Responses are Server-Sent Events,
    # so buffering must be off or tool results arrive late.
    location /mcp {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

</details>

<details>
<summary>Caddy</summary>

```caddy
trek.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Caddy handles TLS and WebSockets automatically.

</details>

<br />

## Environment variables

Every variable, its default and what it does: see
[Environment Variables — 上游 TREK 文件 (upstream docs)](https://github.com/liketrek/TREK/wiki/Environment-Variables).

This fork (ENSCON) adds `OIDC_ALLOW_CROSS_BROWSER_CALLBACK`, `OIDC_HIDE_PASSWORD_FORM`,
`OIDC_BUTTON_COLOR`, `EXTRA_LINK_URL` and `EXTRA_LINK_LABEL`; see `wiki/Environment-Variables.md`.
It also defaults the UI language to 繁體中文 and new trips to TWD.
Note: the database column default for `trips.currency` is still `EUR` (no migration); the app always
writes an explicit currency on insert, so this only matters for rows inserted outside the app.

## ENSCON Trip（ENSCON 旅程）— 我們改了什麼 / What we changed

ENSCON 旅程是 [TREK](https://github.com/liketrek/TREK)（AGPL-3.0）的修改版，給台灣使用者用。
based on TREK (https://github.com/liketrek/TREK) by Maurice, licensed under AGPL-3.0. 基於 TREK，原作者 Maurice 與開源社群。原始碼（含我們的修改）：本 repo。

已完成（第一版）：

- 預設介面語言繁體中文（偵測不到瀏覽器語言時）；分享頁的語言切換會被記住
- 新行程預設幣別 TWD（新台幣）
- `OIDC_ALLOW_CROSS_BROWSER_CALLBACK`：LINE 登入常在 LINE 內建瀏覽器與系統瀏覽器之間切換，開啟後
  callback 沒有 cookie 也接受（有 cookie 但不符仍拒絕；state 仍然一次性）
- `OIDC_HIDE_PASSWORD_FORM`／`OIDC_BUTTON_COLOR`：登入頁只留一顆大的 LINE 登入鈕；網址加 `?pw=1` 還是看得到帳密表單（管理員用）
- 邀請碼（`?invite=`）會記在 localStorage，SSO 連結一律帶上
- `EXTRA_LINK_URL`／`EXTRA_LINK_LABEL`：行程頁右下角的額外連結按鈕（例如小遊戲）
- 按趟收費（`/pricing`）：Recur 單次付款，付款後自動開一個空行程給付款人並產生邀請連結（`/billing/success`）。
  `RECUR_SECRET_KEY`、`RECUR_WEBHOOK_SECRET`、`RECUR_PRODUCT_TRIP_ONCE` 三個都設才開啟，任一個空＝收費頁顯示「即將開放」、webhook 一律拒收；
  webhook 網址 `POST /api/billing/webhook/recur`。顯示用的 `TRIP_BILLING_PRICE_TWD`（預設 299）、`TRIP_BILLING_SEATS`（10）、
  `TRIP_BILLING_DAYS_AFTER_RETURN`（30）；條款／隱私網址 `TRIP_BILLING_TERMS_URL`／`TRIP_BILLING_PRIVACY_URL`（空＝連到 App 內佔位頁 `/legal/terms`、`/legal/privacy`）
- 每一頁左下角放「原始碼」連結（AGPL-3.0 第 13 條）
- 資料庫裡 `trips.currency` 欄位的預設值仍是 `EUR`（沒有做 migration）；程式寫入時一定會帶幣別，所以只有在 app 以外直接寫入資料庫時才有差

### 下一版規劃（依「旅途中最常被問的問題」排序，尚未做）

1. 記帳：日幣與台幣並列、自動換匯、用 LINE Pay／街口結算
2. 伴手禮：誰幫誰買、免稅門檻提示
3. 天氣與穿衣提醒
4. 台灣國定假日與農曆、台灣地名中文、一鍵分享到 LINE 群組
5. 交通卡餘額、租車 ETC 費用、素食與五辛提醒

商標：本 fork 名稱與 logo 為 ENSCON 所有，不使用 TREK 的名稱與 logo。詳見 `NOTICE.md`、`TRADEMARKS.md`。

## Data sources

The Atlas map's country and sub-national (province/county) boundaries come from
[**geoBoundaries**](https://www.geoboundaries.org/) (Runfola et al., 2020), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [NOTICE.md](NOTICE.md)
for full third-party attributions.

<br />

## License

ENSCON Trip (based on [TREK](https://github.com/liketrek/TREK) by Maurice) is [AGPL v3](LICENSE). Self-host freely for personal or internal company use. If you modify and offer ENSCON Trip as a network service to third parties, your modifications must be open-sourced under the same licence.
