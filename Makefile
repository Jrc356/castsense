.PHONY: help up down logs shell \
        install dev test lint clean \
        backend-shell backend-test backend-lint backend-logs \
        contracts-generate-types

# Colors for output
CYAN := \033[0;36m
NC := \033[0m # No Color

help:
	@echo "$(CYAN)CastSense Development Commands (Docker-based)$(NC)"
	@echo ""
	@echo "$(CYAN)Getting Started$(NC)"
	@echo "  make up                - Start Docker Compose (all services)"
	@echo "  make down              - Stop Docker Compose"
	@echo "  make logs              - View Docker logs"
	@echo ""
	@echo "$(CYAN)Development$(NC)"
	@echo "  make shell             - Open shell in backend container"
	@echo "  make backend-shell     - Open shell in backend service"
	@echo "  make dev               - Start backend dev server (via Docker)"
	@echo ""
	@echo "$(CYAN)Testing & Linting$(NC)"
	@echo "  make test              - Run backend tests in Docker"
	@echo "  make backend-test      - Run backend tests"
	@echo "  make backend-lint      - Run backend linting/type check"
	@echo ""
	@echo "$(CYAN)Contracts$(NC)"
	@echo "  make contracts-generate-types - Generate TypeScript types from schemas"
	@echo ""
	@echo "$(CYAN)Utilities$(NC)"
	@echo "  make clean             - Clean all node_modules and build artifacts"
	@echo "  make backend-logs      - View backend service logs"
	@echo ""

# Docker Compose commands
up:
	@echo "$(CYAN)Starting Docker Compose (development)...$(NC)"
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "$(CYAN)✓ Services started$(NC)"
	@echo "Backend API: http://localhost:3000"

down:
	@echo "Stopping Docker Compose..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

logs:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Shell access
shell: backend-shell

backend-shell:
	@echo "Opening shell in backend service..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend sh

backend-logs:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend

# Development (Docker-based)
dev: up
	@echo "$(CYAN)Backend dev server is running in Docker$(NC)"
	@echo "Access API at http://localhost:3000"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend

# Testing (Docker-based)
test: backend-test

backend-test:
	@echo "Running backend tests in Docker..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm test

backend-lint:
	@echo "Running backend linting and type check in Docker..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend sh -c "npm run lint 2>/dev/null || npx tsc --noEmit"

# Contracts (local)
contracts-generate-types:
	@echo "Generating TypeScript types from schemas..."
	cd contracts && npm install && npm run generate-types
	@echo "$(CYAN)✓ Types generated for backend and mobile$(NC)"

# Cleanup
clean:
	@echo "Cleaning node_modules and build artifacts..."
	@rm -rf backend/node_modules mobile/node_modules contracts/node_modules
	@rm -rf backend/dist mobile/dist contracts/dist
	@echo "$(CYAN)✓ Clean complete$(NC)"

# Helpful info
.DEFAULT_GOAL := help
