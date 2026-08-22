install:
	@command -v uv >/dev/null 2>&1 || { echo "uv is not installed. Installing uv..."; curl -LsSf https://astral.sh/uv/install.sh | sh; source $$HOME/.local/bin/env; }
	cd agent && uv sync
	cd desktop && bun install

dev:
	bunx concurrently "make dev-backend" "make dev-frontend"

dev-backend:
	cd agent && uv run adk web . --allow_origins="*"

dev-frontend:
	cd desktop && bun run dev
