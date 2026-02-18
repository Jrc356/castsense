.PHONY: help install dev test lint clean docker docker-down \
        backend-install backend-dev backend-test backend-lint \
        mobile-install mobile-dev mobile-test mobile-ios mobile-android \
        contracts-install contracts-generate-types

# Colors for output
CYAN := \033[0;36m
NC := \033[0m # No Color

help:
	@echo "$(CYAN)CastSense Development Commands$(NC)"
	@echo ""
	@echo "$(CYAN)General$(NC)"
	@echo "  make help              - Show this help message"
	@echo "  make install           - Install dependencies for all workspaces"
	@echo "  make dev               - Start backend dev server"
	@echo "  make test              - Run all tests"
	@echo "  make lint              - Run linting"
	@echo "  make clean             - Clean all node_modules and build artifacts"
	@echo ""
	@echo "$(CYAN)Docker$(NC)"
	@echo "  make docker            - Start Docker Compose (dev environment)"
	@echo "  make docker-down       - Stop Docker Compose"
	@echo ""
	@echo "$(CYAN)Backend$(NC)"
	@echo "  make backend-install   - Install backend dependencies"
	@echo "  make backend-dev       - Start backend development server"
	@echo "  make backend-test      - Run backend tests"
	@echo "  make backend-lint      - Run backend linting/type check"
	@echo ""
	@echo "$(CYAN)Mobile$(NC)"
	@echo "  make mobile-install    - Install mobile dependencies"
	@echo "  make mobile-dev        - Start Metro bundler"
	@echo "  make mobile-test       - Run mobile tests"
	@echo "  make mobile-ios        - Run on iOS simulator"
	@echo "  make mobile-android    - Run on Android device/emulator"
	@echo ""
	@echo "$(CYAN)Contracts$(NC)"
	@echo "  make contracts-install - Install contracts dependencies"
	@echo "  make contracts-generate-types - Generate TypeScript types from schemas"
	@echo ""

# General commands
install: backend-install mobile-install contracts-install
	@echo "$(CYAN)✓ All dependencies installed$(NC)"

dev: backend-dev

test: backend-test mobile-test
	@echo "$(CYAN)✓ All tests passed$(NC)"

lint: backend-lint

clean:
	@echo "Cleaning node_modules and artifacts..."
	@rm -rf backend/node_modules mobile/node_modules contracts/node_modules
	@rm -rf backend/dist mobile/dist
	@echo "$(CYAN)✓ Clean complete$(NC)"

# Docker commands
docker:
	@echo "Starting Docker Compose (development)..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

docker-down:
	@echo "Stopping Docker Compose..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Backend commands
backend-install:
	@echo "Installing backend dependencies..."
	cd backend && npm install

backend-dev:
	@echo "Starting backend development server..."
	cd backend && npm run dev

backend-test:
	@echo "Running backend tests..."
	cd backend && npm test

backend-lint:
	@echo "Running backend linting and type check..."
	cd backend && npm run lint 2>/dev/null || tsc --noEmit

# Mobile commands
mobile-install:
	@echo "Installing mobile dependencies..."
	cd mobile && npm install
	@if [ "$$(uname)" = "Darwin" ]; then \
		echo "Installing iOS pods..."; \
		cd mobile && npx pod-install; \
	fi

mobile-dev:
	@echo "Starting Metro bundler..."
	cd mobile && npm start

mobile-test:
	@echo "Running mobile tests..."
	cd mobile && npm test

mobile-ios:
	@echo "Running on iOS simulator..."
	cd mobile && npm run ios

mobile-android:
	@echo "Running on Android..."
	cd mobile && npm run android

# Contracts commands
contracts-install:
	@echo "Installing contracts dependencies..."
	cd contracts && npm install

contracts-generate-types: contracts-install
	@echo "Generating TypeScript types from schemas..."
	cd contracts && npm run generate-types
	@echo "$(CYAN)✓ Types generated for backend and mobile$(NC)"
