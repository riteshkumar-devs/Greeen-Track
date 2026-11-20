import pytest

from app.core.config import database_url


def test_postgres_url_preserves_encoded_password(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:x%40y@localhost/test")
    assert database_url().password == "x@y"


def test_other_drivers_are_rejected(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
    with pytest.raises(ValueError, match="postgresql"):
        database_url()
