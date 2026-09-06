import datetime

def utc_now() -> datetime.datetime:
    """
    Return current UTC timestamp without deprecation warnings.
    Strikes a balance between modern Python 3.12+ timezone-aware UTC representations
    and PostgreSQL's native TIMESTAMP WITHOUT TIME ZONE (Prisma timestamp(3))
    which asyncpg requires to be offset-naive.
    """
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
