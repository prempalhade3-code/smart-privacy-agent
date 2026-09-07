#!/usr/bin/env python3
"""Development server entrypoint."""

import uvicorn

from app.config.settings import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.vdlm_host,
        port=settings.vdlm_port,
        reload=True,
    )


if __name__ == "__main__":
    main()
