# IPTS Backend Makefile

.PHONY: build up down restart logs clean

# Build and start the application
build:
	docker-compose up --build

# Start the application
up:
	docker-compose up -d

# Stop the application
down:
	docker-compose down

# Restart the application
restart:
	docker-compose restart

# View logs
logs:
	docker-compose logs -f

# Clean up containers and volumes
clean:
	docker-compose down -v
	docker system prune -f

# Run tests (if any)
test:
	docker-compose exec ipts-backend python -m pytest

# Access container shell
shell:
	docker-compose exec ipts-backend bash

# View container status
status:
	docker-compose ps