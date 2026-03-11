#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")/.."
echo "--- Starting auto-update $(date) ---"

# Install the latest version of whatsapp-web.js
echo "Installing latest whatsapp-web.js..."
npm install whatsapp-web.js@latest --no-audit --no-fund --save

# Restart the bot via PM2
echo "Restarting whatsapp-geneline-bridge..."
if command -v pm2 &> /dev/null; then
    pm2 restart whatsapp-geneline-bridge
else
    echo "PM2 is not installed or not in PATH. Skipping restart."
fi

echo "Auto-update complete."
