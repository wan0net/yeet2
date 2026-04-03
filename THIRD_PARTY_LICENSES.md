# Third-Party Licenses

This repository's own source code is licensed under `BSD-3-Clause`. The project
also depends on third-party libraries and services with their own licenses.

## Verified From The Local Workspace

These licenses were verified from the currently installed package metadata in
this repository on April 3, 2026.

| Dependency | Version | License |
| --- | --- | --- |
| `next` | `15.5.14` | `MIT` |
| `react` | `19.2.4` | `MIT` |
| `react-dom` | `19.2.4` | `MIT` |
| `fastify` | `5.8.4` | `MIT` |
| `tailwindcss` | `3.4.19` | `MIT` |
| `postcss` | `8.5.8` | `MIT` |
| `autoprefixer` | `10.4.27` | `MIT` |
| `tsx` | `4.21.0` | `MIT` |
| `typescript` | `5.9.3` | `Apache-2.0` |
| `prisma` | `6.19.3` | `Apache-2.0` |
| `@prisma/client` | `6.19.3` | `Apache-2.0` |

## Python Runtime Dependencies

| Dependency | Version | License Status |
| --- | --- | --- |
| `crewai` | `1.13.0` | Local installed metadata does not expose a clean `License:` field, but its bundled metadata references the MIT license. Upstream verification is still recommended before treating this as final. |
| `openhands` | runtime via `uvx` | Not pinned as a repository dependency in this workspace. Verify the exact upstream package and license at the version deployed in production. |

## Notes

- `BSD-3-Clause` is generally compatible with the `MIT` and `Apache-2.0`
  dependencies listed above for use in this repository.
- If this project starts vendoring third-party source code instead of depending
  on published packages, this inventory should be updated with the bundled code
  licenses and any required notices.
- If deployment pins a specific OpenHands package version, add that version and
  its verified license here.
