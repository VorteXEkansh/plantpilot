.PHONY: dev test seed reset-demo build
dev:
	docker compose up --build
test:
	docker compose run --rm api pytest && npm test
seed:
	docker compose exec api python -m scripts.init_db
reset-demo:
	docker compose down -v && docker compose up --build
build:
	npm run build
