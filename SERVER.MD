# VPS deploy (nginx + pm2)

## Build & restart

```bash
cd /var/www/poker
git pull
pnpm install

VITE_API_URL=http://YOUR_VPS_IP pnpm --filter @neonpoker/web build
pnpm --filter @neonpoker/server build

# Allow browser origin for Socket.IO (REST same-origin may work without this; sockets need it)
CORS_ORIGINS=http://YOUR_VPS_IP pm2 restart neonpoker-server --update-env

sudo nginx -t && sudo systemctl reload nginx
```

`VITE_API_URL` must include scheme: `http://89.x.x.x` (not bare IP).

## nginx (`/etc/nginx/sites-available/poker`)

```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;

    root /var/www/poker/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
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
}
```

## Verify (on VPS)

```bash
# API up
curl -s http://127.0.0.1:3000/health

# Through nginx — must NOT return index.html HTML
curl -s "http://YOUR_VPS_IP/socket.io/?EIO=4&transport=polling" | head -c 80
curl -s http://YOUR_VPS_IP/health

# Built frontend points at VPS, not localhost
grep -r "localhost:3000" apps/web/dist/ && echo "BAD: rebuild with VITE_API_URL" || echo "OK: no localhost"
grep -r "YOUR_VPS_IP" apps/web/dist/assets/*.js | head -1
```

## Browser (Create Room → Join)

Network filter **All** (not only Fetch):

1. `POST http://YOUR_VPS_IP/rooms` → 201
2. `GET http://YOUR_VPS_IP/rooms/<uuid>` → 200
3. `GET http://YOUR_VPS_IP/socket.io/?EIO=4&transport=polling` → 200 (then WS upgrade)

If (1) exists but (2) missing → session stops before socket; check response body / console.

If (1)(2) OK but no (3) → wrong JS bundle or `connectSocket` error in console.

Open site only as `http://YOUR_VPS_IP` (same host as `VITE_API_URL`, no `:3000` in address bar).
