.PHONY: help install setup dev start ios android lint typecheck test \
	contracts-validate contracts-lint-schemas contracts-generate-types \
	clean format

# Default target
help:
	@echo "CastSense - Makefile Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install            Install dependencies for mobile and contracts"
	@echo "  make setup              Alias for install"
	@echo ""
	@echo "Development:"
	@echo "  make start              Start Expo dev server"
	@echo "  make dev                Alias for start"
	@echo "  make ios                Run on iOS simulator"
	@echo "  make android            Run on Android emulator"
	@echo ""
	@echo "Quality & Testing:"
	@echo "  make lint               Run ESLint on mobile + schema validation"
	@echo "  make typecheck          Type-check mobile code with TypeScript"
	@echo "  make test               Run Jest tests in mobile"
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
	@echo "Installing dependencies for mobile and contracts..."
	cd mobile && npm install
	cd contracts && npm install

setup: install

# Development
start:
	@echo "Starting Expo dev server..."
	cd mobile && npm start

dev: start

ios:
	@echo "Running on iOS simulator..."
	cd mobile && npm run ios

android:
	@echo "Running on Android emulator..."
	cd mobile && npm run android

# Quality & Testing
lint:
	@echo "Linting mobile code..."
	cd mobile && npm run lint
	@echo "Validating contract schemas..."
	cd contracts && npm run lint-schemas

typecheck:
	@echo "Type-checking mobile code..."
	cd mobile && npm run typecheck

test:
	@echo "Running mobile tests..."
	cd mobile && npm test

format:
	@echo "Auto-fixing mobile code style..."
	cd mobile && npm run lint -- --fix

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
	rm -rf mobile/node_modules mobile/.expo mobile/.cache mobile/dist
	rm -rf contracts/node_modules contracts/dist
	@echo "Clean complete."
