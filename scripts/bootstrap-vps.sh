#!/bin/bash

# WhatsApp-Geneline Bridge - VPS Bootstrap Script (Root)
# This script installs all necessary dependencies to run the bot on Ubuntu/Debian.

set -e

echo "🚀 Starting VPS Bootstrap for WhatsApp-Geneline Bridge..."

# 1. Update system
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade

# 2. Install Node.js (Version 20.x)
echo "🟢 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install Chromium and dependencies for Puppeteer
echo "🌐 Installing Chromium and system dependencies..."
apt-get install -y \
    chromium-browser \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libxkbcommon0 \
    ca-certificates \
    fonts-liberation \
    lsb-release \
    xdg-utils \
    ffmpeg \
    sox \
    libsox-fmt-all \
    wget

# 4. Install Global Tools
echo "🛠️ Installing PM2 and TypeScript globally..."
npm install -g pm2 typescript ts-node

# 5. Build Project
echo "🏗️ Building the project..."
npm install
npm run build

echo "✅ Bootstrap complete!"
echo "--------------------------------------------------"
echo "Next steps:"
echo "1. Configure your .env file"
echo "2. Start the service with: pm2 start ecosystem.config.js"
echo "3. Scan the QR code by running: pm2 logs"
echo "--------------------------------------------------"
