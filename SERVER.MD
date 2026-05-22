# VPS deploy (nginx + pm2)

Replace `YOUR_VPS_IP` with your server IP (e.g. `89.125.64.106`). Use **http** and **no port** in the browser — same as `VITE_API_URL` / `CORS_ORIGINS`.

## First-time VPS setup

```bash
# Node 20+ and pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
corepack enable && corepack prepare pnpm@latest --activate

sudo mkdir -p /var/www/poker
sudo chown $USER:$USER /var/www/poker
git clone <YOUR_REPO_URL> /var/www/poker
cd /var/www/poker

npm install -g pm2
```

Edit `ecosystem.config.cjs` — set `CORS_ORIGINS` to how users open the site:

```js
CORS_ORIGINS: 'http://YOUR_VPS_IP',
```

Enable nginx site:

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/poker.bak 2>/dev/null || true
sudo nano /etc/nginx/sites-available/poker   # paste server block below
sudo ln -sf /etc/nginx/sites-available/poker /etc/nginx/sites-enabled/poker
sudo rm -f /etc/nginx/sites-enabled/default   # optional: avoid duplicate listen 80
sudo nginx -t && sudo systemctl reload nginx
```

## Build & restart (every deploy)

```bash
cd /var/www/poker
git pull
pnpm install
pnpm build:packages

VITE_API_URL=http://YOUR_VPS_IP pnpm --filter @neonpoker/web build
pnpm --filter @neonpoker/server build

pm2 delete neonpoker-server 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs neonpoker-server --lines 5
# expect: CORS: dev localhost + http://YOUR_VPS_IP

sudo nginx -t && sudo systemctl reload nginx
```

`VITE_API_URL` must include scheme: `http://89.x.x.x` (not bare IP, not `:3000`).

## nginx (`/etc/nginx/sites-available/poker`)

`^~` on `/np-io/` is required — without it `try_files` serves `index.html` instead of proxying Socket.IO.

```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;

    root /var/www/poker/apps/web/dist;
    index index.html;

    location ^~ /np-io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    location ~ ^/(rooms|health) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Verify (on VPS)

```bash
# API up
curl -s http://127.0.0.1:3000/health

# Socket.IO on Node (must start with 0{"sid":, NOT HTML, NOT Cannot GET)
curl -s "http://127.0.0.1:3000/np-io/?EIO=4&transport=polling" | head -c 80

# Through nginx — same: JSON handshake, NOT index.html
curl -s "http://YOUR_VPS_IP/np-io/?EIO=4&transport=polling" | head -c 80
curl -s http://YOUR_VPS_IP/health

# Built frontend uses VPS IP at runtime
grep -r "YOUR_VPS_IP" apps/web/dist/assets/*.js | head -1
# `localhost:3000` in bundle is OK — dev fallback string, not used when VITE_API_URL is set
```

## Browser (Create Room → Join)

Open **only** `http://YOUR_VPS_IP` (no `:3000`). Test in incognito if ad blockers hide `/socket.io/` (we use `/np-io/`).

Network filter **All** (not only Fetch):

1. `POST http://YOUR_VPS_IP/rooms` → 201
2. `GET http://YOUR_VPS_IP/rooms/<uuid>` → 200
3. `GET http://YOUR_VPS_IP/np-io/?EIO=4&transport=polling` → 200 (then WS upgrade)

If (1) exists but (2) missing → session stops before socket; check response body / console.

If (1)(2) OK but no (3) → wrong JS bundle, nginx `^~`, or `connectSocket` error in console.

If curl shows `0{"sid"` but browser has no (3) → `CORS_ORIGINS` mismatch; check `pm2 logs` for CORS line.
