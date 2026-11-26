#!/bin/sh
set -e

CHROME=$(find /root/.cache/ms-playwright /ms-playwright -type f \( -name chrome -o -name chromium \) 2>/dev/null | head -n 1 || true)
if [ -n "$CHROME" ]; then
  export KANE_CLI_CHROME_PATH="$CHROME"
fi

export PATH="${PATH}:/usr/local/bin:/root/.local/bin"
LISTEN_PORT="${PORT:-10000}"

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen ${LISTEN_PORT};
  root /app/apps/web/dist;

  location = /pitch { try_files /index.html =404; }
  location = /verified { try_files /index.html =404; }
  location = /jobs { try_files /index.html =404; }

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location /v1/ {
    proxy_pass http://127.0.0.1:4031/v1/;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location = /health {
    proxy_pass http://127.0.0.1:4031/health;
  }
}
EOF

# 1. Start local Temporal server inside container
temporal server start-dev --ip 127.0.0.1 --port 7233 >/tmp/temporal.log 2>&1 &
sleep 3

# 2. Apply schema against DATABASE_URL
PORT=4031 API_PORT=4031 npm run migrate

# 3. Start API server and Temporal worker runner (streaming logs to stdout for Render UI)
PORT=4031 API_PORT=4031 npm run start -w @postready/server &
WORKER_PORT=4098 npm run start -w @postready/runner &

# 4. Serve SPA + reverse proxy /v1 and /health on Render's $PORT
exec nginx -g 'daemon off;'
