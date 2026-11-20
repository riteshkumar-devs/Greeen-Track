import os
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import URL, make_url


def database_url() -> URL:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    value = os.environ.get("DATABASE_URL") or dotenv_values(env_path).get("DATABASE_URL")
    if not value:
        raise ValueError("Set DATABASE_URL in backend/.env or the environment.")
    url = make_url(value)
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use the postgresql+psycopg driver.")
    return url
