# Kay API Multipart Upload Issue - Bug Report

## Summary
The `/api/v1/transcribe` endpoint returns **404 Not Found** when receiving multipart form data uploads, but works correctly with simple JSON POST requests.

## Environment
- **Endpoint**: `https://kay.geneline-x.net/api/v1/transcribe`
- **Client**: Render.com servers (Node.js application)
- **Issue**: Multipart form uploads return 404 with frp proxy error page

## Test Results

### ✅ Test 1: Simple POST (No File)
```bash
curl -X POST https://kay.geneline-x.net/api/v1/transcribe \
  -H "X-API-Key: xxx"
```
**Result**: `400 {"error":"invalid multipart form"}` ✅ Works!

### ❌ Test 2: Multipart Form Upload
```javascript
const formData = new FormData();
formData.append('file', audioBuffer, {
    filename: 'audio.ogg',
    contentType: 'audio/ogg',
});

https.request({
    method: 'POST',
    headers: {
        ...formData.getHeaders(),
        'X-API-Key': apiKey,
    }
})
```
**Result**: `404 Not Found` with frp proxy error page ❌ Fails!

### ✅ Test 3: JSON with Base64
```javascript
POST /api/v1/transcribe
Content-Type: application/json
{
    "audio": "base64data...",
    "format": "ogg"
}
```
**Result**: `400 {"error":"invalid multipart form"}` ✅ Reaches endpoint!

## Root Cause
The **frp reverse proxy** is not correctly routing multipart form data requests to the backend API. When `Content-Type: multipart/form-data` is used, the request returns a 404 error page from frp instead of reaching the API.

## Error Response
```html
<!DOCTYPE html>
<html>
<head><title>Not Found</title></head>
<body>
<h1>The page you requested was not found.</h1>
<p>The server is powered by <a href="https://github.com/fatedier/frp">frp</a>.</p>
</body>
</html>
```

## Expected Behavior
Multipart form uploads should reach the `/api/v1/transcribe` endpoint and return either:
- `200` with transcription result (if audio is valid)
- `400` with error message (if audio is invalid)
- `403` if API key is invalid

## Impact
- Voice message transcription is completely broken
- WhatsApp bot cannot process voice messages
- Users receive error: "I received your voice message but couldn't understand it"

## Workaround Needed
Is there:
1. An alternative endpoint that accepts multipart uploads?
2. A different upload method we should use?
3. A fix timeline for the frp proxy configuration?

## Technical Details
- **frp version**: Unknown (from error page)
- **nginx version**: 1.29.3 (from response headers)
- **Request headers**: 
  ```
  Content-Type: multipart/form-data; boundary=...
  X-API-Key: kay_xxx...
  ```

## Contact
Please advise on how to proceed with voice transcription uploads.
