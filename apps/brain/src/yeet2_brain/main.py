"""Brain service entrypoint."""

from __future__ import annotations

from .http import serve


def main() -> None:
    serve()


if __name__ == "__main__":
    main()

