#!/bin/bash

# WhatsApp-Geneline Bridge - Multi-User Isolated Infrastructure Setup
# This script configures Nginx to route ONLY your domain to your specific directory.

set -e

DOMAIN="www.geneline-x.net"
APP_PORT=3000
CONF_NAME="geneline-bridge"

echo "🚀 Starting Isolated Infrastructure Setup for $DOMAIN..."

# 1. Install Dependencies (if not present)
echo "📦 Ensuring Nginx and Certbot are installed..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# 2. Create Unique Nginx Configuration
# This ensures that Nginx only routes traffic for YOUR domain to YOUR app.
echo "📝 Creating isolated Nginx config at /etc/nginx/sites-available/$CONF_NAME..."
cat > /etc/nginx/sites-available/$CONF_NAME <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 3. Enable Configuration safely
echo "🔗 Enabling configuration..."
ln -sf /etc/nginx/sites-available/$CONF_NAME /etc/nginx/sites-enabled/
# We do NOT remove the default or other configs here to avoid breaking other users.

# 4. Test and Reload
echo "🔄 Reloading Nginx..."
if nginx -t; then
    systemctl reload nginx
    echo "✅ Success! Nginx is now routing $DOMAIN to your project directory."
else
    echo "❌ Nginx configuration test failed. Please check for conflicts with other users."
    exit 1
fi

echo "--------------------------------------------------"
echo "Multi-User Safety Check:"
echo "1. Your app is isolated by 'server_name $DOMAIN'."
echo "2. Other domains on this VPS will continue to work normally."
echo "3. Run this for SSL: certbot --nginx -d $DOMAIN"
echo "--------------------------------------------------"
