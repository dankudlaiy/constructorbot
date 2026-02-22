#!/bin/bash
set -euo pipefail

echo "=== ConstructorBot — AWS Deploy Script ==="

# 1. System update
echo "[1/5] Updating system..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "[2/5] Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to re-login for group changes."
else
    echo "[2/5] Docker already installed."
fi

# 3. Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "[3/5] Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "[3/5] Docker Compose already installed."
fi

# 4. Create .env if not exists
if [ ! -f .env ]; then
    echo "[4/5] Creating .env from template..."
    cat > .env << 'ENVEOF'
DATABASE_URL=postgres://banner_user:banner_pass@db:5432/banner_db

DB_USER=banner_user
DB_PASS=CHANGE_ME_STRONG_PASSWORD
DB_NAME=banner_db

TELEGRAM_BOT_TOKEN=YOUR_LEGACY_TOKEN
TELEGRAM_BOT_TOKEN_COLDBET=YOUR_COLDBET_TOKEN
TELEGRAM_BOT_TOKEN_SPINBETTER=YOUR_SPINBETTER_TOKEN

APP_URL=https://your-domain.com
DOMAIN=your-domain.com

ADMIN_USER=admin
ADMIN_PASS=CHANGE_ME_STRONG_PASSWORD
ENVEOF
    echo ">>> Edit .env with your actual values: nano .env"
    exit 0
else
    echo "[4/5] .env already exists."
fi

# 5. Install Node.js and build frontend
if ! command -v node &> /dev/null; then
    echo "[5/7] Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[5/7] Node.js already installed."
fi

echo "[6/7] Building frontend assets..."
npm install && npm run build && npm run build:admin
cd miniapp && npm install && npm run build && cd ..

# 7. Build and start
echo "[7/7] Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Deploy complete! ==="
echo "Services running:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Next steps:"
echo "  1. Set Telegram webhooks (run once):"
echo "     source .env"
echo '     curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_COLDBET}/setWebhook?url=${APP_URL}/miniapp/webhook.php?brand=coldbet"'
echo '     curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_SPINBETTER}/setWebhook?url=${APP_URL}/miniapp/webhook.php?brand=spinbetter"'
echo ""
echo "  2. Check logs:"
echo "     docker compose -f docker-compose.prod.yml logs -f"
