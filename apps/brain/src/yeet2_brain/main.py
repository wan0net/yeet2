"""Brain service entrypoint."""

from __future__ import annotations

from .runtime import bootstrap_runtime

bootstrap_runtime()

from .http import serve


def main() -> None:
    serve()


if __name__ == "__main__":
    main()
