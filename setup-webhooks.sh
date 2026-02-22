#!/bin/bash
set -euo pipefail

if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

source .env

echo "Setting up Telegram webhooks..."
echo ""

echo "ColdBet webhook:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_COLDBET}/setWebhook?url=${APP_URL}/webhook.php?brand=coldbet" | python3 -m json.tool
echo ""

echo "SpinBetter webhook:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_SPINBETTER}/setWebhook?url=${APP_URL}/webhook.php?brand=spinbetter" | python3 -m json.tool
echo ""

echo "Verifying webhooks..."
echo ""

echo "ColdBet info:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_COLDBET}/getWebhookInfo" | python3 -m json.tool
echo ""

echo "SpinBetter info:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_SPINBETTER}/getWebhookInfo" | python3 -m json.tool
