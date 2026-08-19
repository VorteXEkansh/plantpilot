#!/bin/sh
set -eu
alembic -c alembic.ini upgrade head
python -m scripts.init_db
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
