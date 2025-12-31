# Voice Transcription 404 Error - Fix

## Problem Identified

The logs show:
```
"error":"Request failed with status code 404"
"apiHost":"https://kay.geneline-x.net"
```

The Kay API endpoint is returning **404 Not Found** on Render, but works locally.

## Root Cause

The 404 error with an frp proxy response suggests:
1. **DNS resolution issue** on Render's servers
2. **Network routing problem** between Render and Kay API
3. **Firewall/proxy blocking** the request

## Immediate Solutions

### Option 1: Check KAY_HOST Environment Variable

The `KAY_HOST` on Render might be set incorrectly or pointing to an old endpoint.

**Action:**
1. Go to Render dashboard
2. Check the `KAY_HOST` environment variable
3. Make sure it's set to: `https://kay.geneline-x.net`
4. If it's different, update it and redeploy

### Option 2: Try Alternative Endpoint

If Kay has a different production endpoint, update `KAY_HOST` to use it.

**Possible alternatives:**
- `https://api.kay.geneline-x.net`
- `https://kay-api.geneline-x.net`
- Direct IP address (if DNS is the issue)

### Option 3: Contact Kay API Support

Since the endpoint works locally but not on Render:
1. The Kay API might be blocking Render's IP addresses
2. There might be a firewall rule preventing access
3. The service might need to whitelist Render's servers

**Information to provide:**
- Error: 404 Not Found
- Endpoint: `https://kay.geneline-x.net/api/v1/transcribe`
- Source: Render.com servers
- Works locally: Yes
- Error response: frp proxy "page not found"

## Temporary Workaround

Until the Kay API issue is resolved, you have two options:

### A. Disable Voice Transcription

Add this to your Render environment:
```
ENABLE_VOICE_TRANSCRIPTION=false
```

Then update the code to skip transcription when disabled.

### B. Use Text-Only Mode

Modify the bot to respond to voice messages with:
> "Voice messages are temporarily unavailable. Please send a text message instead."

## Testing Commands

To verify the issue:

```bash
# Test from your local machine (should work)
curl -X POST https://kay.geneline-x.net/api/v1/transcribe \
  -H "X-API-Key: your-key" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 403 (invalid key) or 400 (missing file)
```

```bash
# Test from Render (via shell)
# Go to Render dashboard > Shell tab
curl -X POST https://kay.geneline-x.net/api/v1/transcribe \
  -H "X-API-Key: $KAY_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"

# If you get 404, it's a network/routing issue
```

## Next Steps

1. **Verify KAY_HOST** is correct on Render
2. **Test from Render shell** to confirm the 404 error
3. **Contact Kay API support** with the error details
4. **Consider alternative endpoints** if available

## Questions for Kay API Team

1. Is `https://kay.geneline-x.net/api/v1/transcribe` the correct endpoint?
2. Are there any IP whitelisting requirements?
3. Is there an alternative endpoint we can use?
4. Why does the request return an frp proxy error page?
