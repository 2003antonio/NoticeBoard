import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("noticeboard")


class AppError(Exception):
    """An expected error that should reach the client with a clear message."""

    def __init__(self, status_code: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code


def _body(message: str, code: str | None = None) -> dict:
    return {"error": message, **({"code": code} if code else {})}


def register_error_handlers(app: FastAPI) -> None:
    """Every error leaves the API in the same shape: {"error": "..."}."""

    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError):
        return JSONResponse(_body(exc.message, exc.code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(_body("Invalid request"), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(_body(str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        log.exception("Unhandled error")  # details stay in the server log only
        return JSONResponse(_body("Something went wrong"), status_code=500)
