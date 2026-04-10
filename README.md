# SignDesk

A privacy-first, browser-based document signing and stamping tool. Upload a document, place signatures and stamps on any page, then download a flattened PDF with all annotations baked in. All processing runs entirely in the browser — no document data is ever sent to a server.

## Screenshots

*Coming after v1 release.*

## Quick Start

```bash
docker compose up -d
```

Access at [http://localhost:8420](http://localhost:8420).

## Deployment Behind nginx + Authentik

### nginx Reverse Proxy Configuration

```nginx
server {
    server_name signdesk.yourdomain.com;

    # Authentik forward auth
    location /outpost.goauthentik.io {
        proxy_pass https://auth.yourdomain.com;
        # ... (standard Authentik outpost config)
    }

    location / {
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;

        proxy_pass http://127.0.0.1:8420;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase body size for large document uploads
        client_max_body_size 50m;
    }

    @goauthentik_proxy_signin {
        return 302 https://auth.yourdomain.com/outpost.goauthentik.io/start?rd=$scheme://$host$request_uri;
    }
}
```

### Notes

- SignDesk has no built-in authentication — auth is handled entirely at the proxy layer.
- The app is stateless: no documents are stored server-side.

## Development

Requirements: Node 22+

```bash
npm install
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173).

## Building the Container

```bash
docker build -t signdesk .
```

Or pull from GHCR:

```bash
docker pull ghcr.io/<org>/signdesk:latest
```

## Supported Formats

### Input Documents

| Format | Notes |
|---|---|
| PDF (`.pdf`) | Direct rendering |
| Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tiff`) | Wrapped in a single-page PDF |
| SVG (`.svg`) | Rasterized to canvas, then wrapped in PDF |
| Plain text (`.txt`) | Rendered to paginated A4 PDF (Courier, 10pt) |

### Signatures / Stamps

| Format | Notes |
|---|---|
| PNG (`.png`) | Preferred — supports transparency |
| WebP (`.webp`) | Supports transparency |
| SVG (`.svg`) | Rasterized to PNG before placement |
| JPG (`.jpg`, `.jpeg`) | Re-encoded to PNG for consistent export |

### Output

| Format | Notes |
|---|---|
| PDF (`.pdf`) | Flattened PDF, all annotations baked in as embedded images |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select / Move tool |
| `S` | Sign tool |
| `T` | Stamp tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Delete` / `Backspace` | Delete selected annotation |
| `←` / `→` | Previous / Next page |
| `Ctrl+Scroll` | Zoom |

## License

TBD
