#!/bin/sh
set -eu

pnpm --filter @yeet2/db exec prisma generate
pnpm --filter @yeet2/db exec prisma db push --skip-generate
