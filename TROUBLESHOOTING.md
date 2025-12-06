# WhatsApp Client Troubleshooting

## Issue: Client Stuck at "Initializing WhatsApp client..."

### Symptoms
- Application starts successfully
- API server is running
- Logs show "Initializing WhatsApp client..." but nothing happens after
- No QR code appears in terminal

### Common Causes
1. **Corrupted or expired session** - The saved authentication session in `.wwebjs_auth` is invalid
2. **Puppeteer/Chrome issues** - The headless browser can't launch properly
3. **Network connectivity** - Can't connect to WhatsApp servers

### Solutions

#### Solution 1: Clear Saved Session (Recommended First Step)

Stop the application (Ctrl+C) and run:

```bash
# Remove the saved authentication session
rm -rf .wwebjs_auth .wwebjs_cache

# Restart the application
npm run dev
```

This will force a fresh QR code scan. You should see:
```
═══════════════════════════════════════════════════════
QR CODE RECEIVED - Please scan with WhatsApp mobile app
═══════════════════════════════════════════════════════
[QR code displayed here]
═══════════════════════════════════════════════════════
Waiting for QR code scan...
═══════════════════════════════════════════════════════
```

Scan the QR code with your WhatsApp mobile app:
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code shown in your terminal

#### Solution 2: Increase Timeout

If the issue persists, the Puppeteer browser might need more time to launch. Edit `src/whatsapp/client.ts`:

```typescript
puppeteer: {
    headless: true,
    args: [
        // ... existing args
    ],
    timeout: 120000, // Increase from 60000 to 120000 (2 minutes)
},
```

#### Solution 3: Check Chrome/Chromium Installation

whatsapp-web.js uses Puppeteer which requires Chrome/Chromium. Verify it's installed:

```bash
# Check if Chromium is available
ls ~/.cache/puppeteer/

# If missing, reinstall dependencies
npm install
```

#### Solution 4: Enable Debug Logging

Add more verbose logging to see what's happening:

```bash
# Set debug environment variable
DEBUG=puppeteer:* npm run dev
```

#### Solution 5: Check for Port Conflicts

Make sure no other instance is running:

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill any existing processes
pkill -f "ts-node src/index.ts"
```

### Verification

Once working, you should see:

```
✓ WhatsApp client authenticated successfully
═══════════════════════════════════════════════════════
✓ WhatsApp client is READY
═══════════════════════════════════════════════════════
Connected as: Your Name (mac)
✓ Broadcast scheduler started (runs every minute)
Application started successfully
```

### Still Having Issues?

1. Check your internet connection
2. Verify WhatsApp Web works in your browser (https://web.whatsapp.com)
3. Try using a different network (sometimes corporate firewalls block WhatsApp)
4. Check the logs for any error messages
5. Ensure you're using a supported Node.js version (14.x or higher)

### Getting Help

If none of these solutions work, check:
- Application logs in the terminal
- System logs for any Chrome/Chromium crashes
- Network connectivity to WhatsApp servers
- File permissions on `.wwebjs_auth` directory
