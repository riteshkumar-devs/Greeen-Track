from fastapi import APIRouter

from app.schemas.health import Health

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Health check", response_description="API is healthy",
            openapi_extra={"security": []})
def health() -> Health:
    return Health(status="ok", service="greentrack-api")
