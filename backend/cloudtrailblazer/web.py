"""Read-only localhost HTTP adapter and bundled investigation client."""

from pathlib import Path
from typing import Annotated

import duckdb
import simplejson as json
from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from cloudtrailblazer.cases import CaseStore
from cloudtrailblazer.relationships import GraphScope, ProjectionLimitExceeded, RelationshipStore

PageLimit = Annotated[int, Query(ge=1, le=500)]
PageOffset = Annotated[int, Query(ge=0)]


def _json(value, status: int = 200) -> Response:
    # Returning Response bypasses FastAPI's Decimal-to-float conversion.
    return Response(json.dumps(value), status_code=status, media_type="application/json")


def _error(status: int, code: str, message: str) -> Response:
    return _json({"error": {"code": code, "message": message}}, status)


def _scope(
    start: str | None = None,
    end: str | None = None,
    identity: str | None = None,
    expand_sessions: bool = False,
) -> GraphScope:
    return GraphScope(start, end, identity, expand_sessions)


Scope = Annotated[GraphScope, Depends(_scope)]


def create_app(cases: CaseStore, *, relationships: RelationshipStore | None = None) -> FastAPI:
    """Serve one configured case root; no browser writes, arbitrary paths or remote bind."""
    relationships = relationships or RelationshipStore(cases)
    assets = Path(__file__).parent / "static"
    app = FastAPI(title="Cloudtrailblazer", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])

    @app.middleware("http")
    async def local_response(request: Request, call_next):
        origin = request.headers.get("origin")
        if request.headers.get("sec-fetch-site") == "cross-site" or (
            origin and origin != str(request.base_url).rstrip("/")
        ):
            response = _error(403, "foreign_origin", "Open this workbench from its local address")
        else:
            response = await call_next(request)
        response.headers.update(
            {
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; "
                "style-src 'self'; img-src 'self' data:; connect-src 'self'; "
                "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
                "Referrer-Policy": "no-referrer",
            }
        )
        return response

    @app.exception_handler(ProjectionLimitExceeded)
    async def budget_error(request: Request, exc: ProjectionLimitExceeded):
        return _error(413, "projection_limit", str(exc))

    @app.exception_handler(ValueError)
    async def invalid_request(request: Request, exc: ValueError):
        return _error(400, "invalid_request", str(exc))

    @app.exception_handler(KeyError)
    @app.exception_handler(FileNotFoundError)
    async def missing_item(request: Request, exc: Exception):
        return _error(404, "not_found", "Case, event or connection not found in this scope")

    @app.exception_handler(OSError)
    @app.exception_handler(duckdb.Error)
    async def unavailable_case(request: Request, exc: Exception):
        return _error(
            409, "case_unavailable", "Case data is unavailable; check the local case files"
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_query(request: Request, exc: RequestValidationError):
        fields = sorted({str(error["loc"][-1]) for error in exc.errors()})
        return _error(422, "invalid_query", "Invalid query fields: " + ", ".join(fields))

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return _error(exc.status_code, "http_error", str(exc.detail))

    @app.get("/api/cases")
    def list_cases(limit: PageLimit = 100, offset: PageOffset = 0):
        return _json(cases.list_cases(limit=limit, offset=offset))

    @app.get("/api/cases/{case_id}")
    def summary(case_id: str):
        return _json(cases.summary(case_id))

    @app.get("/api/cases/{case_id}/events")
    def events(
        case_id: str,
        start: str | None = None,
        end: str | None = None,
        limit: PageLimit = 100,
        offset: PageOffset = 0,
    ):
        return _json(cases.event_page(case_id, start=start, end=end, limit=limit, offset=offset))

    @app.get("/api/cases/{case_id}/events/{event_key}")
    def evidence(case_id: str, event_key: str, limit: PageLimit = 50, offset: PageOffset = 0):
        evidence = cases.evidence(case_id, event_key)
        occurrences = evidence["occurrences"]
        return _json(
            {
                "event_key": event_key,
                "event_json": json.dumps(evidence["event"], indent=2),
                "occurrence_count": len(occurrences),
                "occurrences": occurrences[offset : offset + limit],
            }
        )

    @app.get("/api/cases/{case_id}/identities")
    def identities(
        case_id: str, scope: Scope, search: str = "", limit: PageLimit = 100, offset: PageOffset = 0
    ):
        return _json(
            relationships.identities(
                case_id,
                start=scope.start,
                end=scope.end,
                expand_sessions=scope.expand_sessions,
                search=search,
                limit=limit,
                offset=offset,
            )
        )

    @app.get("/api/cases/{case_id}/graph")
    def graph(case_id: str, scope: Scope):
        return _json(relationships.graph(case_id, scope))

    @app.get("/api/cases/{case_id}/connections/{connection_id}/events")
    def connection_events(
        case_id: str,
        connection_id: str,
        scope: Scope,
        limit: PageLimit = 100,
        offset: PageOffset = 0,
    ):
        return _json(
            relationships.connection_events(
                case_id, connection_id, scope, limit=limit, offset=offset
            )
        )

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(assets / "index.html")

    app.mount("/assets", StaticFiles(directory=assets), name="assets")
    return app
