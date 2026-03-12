#!/bin/bash
set -e

# Navigate to the project root directory
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== whatsapp-web.js Auto-Updater ==="
echo "Time: $(date)"
echo "Project: $PROJECT_DIR"

# Get current installed version
CURRENT_VERSION=$(node -p "require('./node_modules/whatsapp-web.js/package.json').version" 2>/dev/null || echo "unknown")
echo "Current version: $CURRENT_VERSION"

# Check what the latest version is on npm
LATEST_VERSION=$(npm view whatsapp-web.js version 2>/dev/null || echo "unknown")
echo "Latest version on npm: $LATEST_VERSION"

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
    echo "Already on latest version ($CURRENT_VERSION). No update needed."
    echo "=== Clearing stale WhatsApp Web cache just in case ==="
    # Still clear cache periodically to prevent stale web version issues
    if [ -d ".wwebjs_cache" ]; then
        rm -rf .wwebjs_cache
        echo "Cache cleared."
    fi
    # Restart to pick up the fresh cache
    if command -v pm2 &> /dev/null; then
        pm2 restart whatsapp-geneline-bridge --update-env
    fi
    echo "=== Done ==="
    exit 0
fi

echo "Update available: $CURRENT_VERSION -> $LATEST_VERSION"

# Step 1: Install latest whatsapp-web.js
echo "Installing whatsapp-web.js@latest..."
npm install whatsapp-web.js@latest --no-audit --no-fund --save 2>&1

# Step 2: Clear the WhatsApp Web cache (prevents stale protocol errors)
echo "Clearing WhatsApp Web cache..."
if [ -d ".wwebjs_cache" ]; then
    rm -rf .wwebjs_cache
    echo "Cache directory removed."
else
    echo "No cache directory found."
fi

# Step 3: Restart the bot via PM2
echo "Restarting whatsapp-geneline-bridge..."
if command -v pm2 &> /dev/null; then
    pm2 restart whatsapp-geneline-bridge --update-env
    echo "Bot restarted successfully."
else
    echo "WARNING: PM2 not found. Please restart the bot manually."
fi

# Verify new version
NEW_VERSION=$(node -p "require('./node_modules/whatsapp-web.js/package.json').version" 2>/dev/null || echo "unknown")
echo "Updated to version: $NEW_VERSION"
echo "=== Auto-update complete ==="
