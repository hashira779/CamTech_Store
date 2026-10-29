"""Human-readable request-validation messages shared by the monolith and every microservice."""
from typing import Any, Dict, List


def format_validation_errors(errors: List[Dict[str, Any]]) -> str:
    """
    Turns Pydantic errors into "field: reason; field: reason" — what a form alert should show.
    e.g. [{'loc': ('body', 'accountId'), 'msg': 'Value error, Bakong Account ID must look like name@bank'}]
         -> "accountId: Bakong Account ID must look like name@bank"
    """
    parts = []
    for err in errors:
        loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "header")]
        msg = str(err.get("msg", "Invalid value"))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        parts.append(f"{'.'.join(loc)}: {msg}" if loc else msg)
    return "; ".join(parts) or "Invalid request"


def validation_error_details(errors: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """JSON-safe per-field list for clients that highlight individual inputs."""
    return [
        {
            "field": ".".join(str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "header")),
            "message": str(e.get("msg", "")).removeprefix("Value error, "),
        }
        for e in errors
    ]
