
.PHONY: help install setup dev start lint typecheck test \
	contracts-validate contracts-lint-schemas contracts-generate-types \
	clean format

# Default target
help:
	@echo "CastSense - Makefile Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install            Install dependencies for web and contracts"
	@echo "  make setup              Alias for install"
	@echo ""
	@echo "Development:"
	@echo "  make start              Start Vite dev server"
	@echo "  make dev                Alias for start"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  make lint               Run ESLint on web + schema validation"
	@echo "  make typecheck          Type-check web code with TypeScript"
	@echo "  make test               Run tests in web"
	@echo "  make format             Auto-fix code style (ESLint + Prettier)"
	@echo ""
	@echo "Contracts & Types:"
	@echo "  make contracts-validate         Validate all schemas against examples"
	@echo "  make contracts-lint-schemas     Lint and compile JSON Schemas"
	@echo "  make contracts-generate-types   Generate TypeScript types from schemas"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean              Remove build artifacts and caches"
	@echo ""

# Setup & Installation
install:
	@echo "Installing dependencies for web and contracts..."
	cd web && npm install
	cd contracts && npm install

setup: install

# Development
start:
	@echo "Starting Vite dev server..."
	cd web && npm run dev

dev: start

# Quality & Testing
lint:
	@echo "Linting web code..."
	cd web && npm run lint
	@echo "Validating contract schemas..."
	cd contracts && npm run lint-schemas

typecheck:
	@echo "Type-checking web code..."
	cd web && npm run typecheck

test:
	@echo "Running web tests..."
	cd web && npm run test

format:
	@echo "Auto-fixing web code style..."
	cd web && npm run lint -- --fix

# Contracts & Types
contracts-validate:
	@echo "Validating contract schemas..."
	cd contracts && npm run validate

contracts-lint-schemas:
	@echo "Linting contract schemas..."
	cd contracts && npm run lint-schemas

contracts-generate-types:
	@echo "Generating TypeScript types from schemas..."
	cd contracts && npm run generate-types

# Cleanup
clean:
	@echo "Cleaning build artifacts..."
	rm -rf web/node_modules web/dist web/coverage
	rm -rf contracts/node_modules contracts/dist
	@echo "Clean complete."
