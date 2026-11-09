#!/usr/bin/env bash
# Bus 225 botini Ubuntu 22.04 VPS'ga o'rnatish / yangilash.
#   sudo bash deploy/install.sh bus.mentorme.uz
# Qayta ishga tushirilsa — kodni yangilaydi va xizmatni qayta yoqadi.
set -euo pipefail

DOMAIN="${1:-bus.mentorme.uz}"
APP_DIR=/opt/bus225
REPO=https://github.com/DeveloperIlhombek/bus225.git

[[ $EUID -eq 0 ]] || { echo "sudo bilan ishga tushiring"; exit 1; }

echo "==> Paketlar"
apt-get update -qq
apt-get install -y -qq git nginx certbot python3-certbot-nginx curl >/dev/null

echo "==> Foydalanuvchi va kod"
id bus225 &>/dev/null || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin bus225
if [[ -d $APP_DIR/.git ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
fi

echo "==> Python 3.12 (uv orqali — Ubuntu 22.04 da 3.10 bor, bizga 3.11+ kerak)"
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
fi
cd "$APP_DIR"
UV_PYTHON_INSTALL_DIR=/opt/uv-python uv venv --python 3.12 --allow-existing .venv
uv pip install --python .venv/bin/python -q -e .

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "!!! $APP_DIR/.env yaratildi — BOT_TOKEN, DRIVERS, GROUP_CHAT_ID ni yozing va qayta ishga tushiring."
fi
chown -R bus225:bus225 "$APP_DIR"

echo "==> systemd"
cp deploy/bus225-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bus225-bot
systemctl restart bus225-bot

echo "==> nginx + HTTPS"
sed "s/bus.mentorme.uz/$DOMAIN/g" deploy/nginx-bus.conf > /etc/nginx/sites-available/"$DOMAIN"
ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/"$DOMAIN"
nginx -t && systemctl reload nginx
if [[ ! -d /etc/letsencrypt/live/$DOMAIN ]]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

echo
echo "✓ Tayyor. Tekshirish: curl https://$DOMAIN/api/health"
echo "  Loglar: journalctl -u bus225-bot -f"
