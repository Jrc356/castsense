
.PHONY: help install setup dev start start-single lint typecheck test clean format

# Default target
help:
	@echo "CastSense - Makefile Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install            Install dependencies for web and backend"
	@echo "  make setup              Alias for install"
	@echo ""
	@echo "Development:"
	@echo "  make start              Start Vite dev server"
	@echo "  make start-single       Build web + backend and serve from backend"
	@echo "  make dev                Alias for start"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  make lint               Run ESLint on web"
	@echo "  make typecheck          Type-check web and backend code with TypeScript"
	@echo "  make test               Run tests in web"
	@echo "  make format             Auto-fix code style (ESLint + Prettier)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean              Remove build artifacts and caches"
	@echo ""

# Setup & Installation
install:
	@echo "Installing dependencies for web and backend..."
	cd web && npm install
	cd backend && npm install

setup: install

# Development
start:
	@echo "Starting Vite dev server..."
	cd web && npm run dev

start-single:
	@echo "Building web and backend for single-service run..."
	cd web && npm run build
	cd backend && npm run build
	cd backend && rm -rf public && mkdir -p public && cp -r ../web/dist/. public
	cd backend && npm run start

dev: start

# Quality & Testing
lint:
	@echo "Linting web code..."
	cd web && npm run lint

typecheck:
	@echo "Type-checking web and backend code..."
	cd web && npm run typecheck
	cd backend && npm run typecheck

test:
	@echo "Running web tests..."
	cd web && npm run test

format:
	@echo "Auto-fixing web code style..."
	cd web && npm run lint -- --fix

# Cleanup
clean:
	@echo "Cleaning build artifacts..."
	rm -rf web/node_modules web/dist web/coverage
	rm -rf backend/node_modules backend/dist backend/public
	@echo "Clean complete."
