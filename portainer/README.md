# Portainer stacks

| Stack YAML | Service |
|------------|---------|
| `lifestyle-studio.stack.yml` | Nano Banana lifestyle image studio |

## Deploy Lifestyle Studio

1. In Portainer → Stacks → Add stack
2. Paste `lifestyle-studio.stack.yml` (or upload)
3. Set environment variables:
   - `GEMINI_API_KEY` (required for real images)
   - Optional: `LIFESTYLE_PORT`, model / size overrides
4. Deploy and open `http://<host>:8080`
