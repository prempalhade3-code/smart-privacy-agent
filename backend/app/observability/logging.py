import structlog


def configure_logging(level: str = "INFO") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            _level_to_int(level)
        ),
    )


def _level_to_int(level: str) -> int:
    import logging

    return getattr(logging, level.upper(), logging.INFO)


def get_logger(name: str):
    return structlog.get_logger(name)
