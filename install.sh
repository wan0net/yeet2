#!/usr/bin/env bash
# yeet2 install / update script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/wan0net/yeet2/main/install.sh | bash
#   Or run directly from a cloned repo: bash install.sh
set -euo pipefail

REPO_URL="https://github.com/wan0net/yeet2.git"
INSTALL_DIR="${YEET2_DIR:-$HOME/yeet2}"
COMPOSE_FILE="${YEET2_COMPOSE_FILE:-docker-compose.deploy.yml}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

generate_token() {
  openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32
}

replace_env_value() {
  local file="$1" key="$2" value="$3" escaped_value
  escaped_value=${value//\\/\\\\}
  escaped_value=${escaped_value//&/\\&}
  sed -i.bak "s|^${key}=.*|${key}=${escaped_value}|" "$file"
  rm -f "$file.bak"
}

# ── Prerequisites ─────────────────────────────────────────────────────────────
check_deps() {
  info "Checking dependencies..."
  for cmd in docker git; do
    command -v "$cmd" &>/dev/null || die "$cmd is required but not installed."
  done
  docker compose version &>/dev/null || die "Docker Compose v2 is required. Install the 'docker-compose-plugin'."
  ok "All dependencies found."
}

# ── Clone or update ───────────────────────────────────────────────────────────
clone_or_update() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Found existing repo at $INSTALL_DIR — pulling latest..."
    git -C "$INSTALL_DIR" pull --ff-only
    ok "Repo updated."
  else
    info "Cloning yeet2 into $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repo cloned."
  fi
}

# ── .env setup ────────────────────────────────────────────────────────────────
setup_env() {
  local env_file="$INSTALL_DIR/.env"
  if [ -f "$env_file" ]; then
    ok ".env already exists — skipping template copy."
    return
  fi

  info "Creating .env from template..."
  cp "$INSTALL_DIR/.env.example" "$env_file"

  # Prompt for required values if running interactively
  if [ -t 0 ]; then
    echo ""
    echo "  Required configuration:"
    echo ""

    read -rp "  Host URL for the Control UI (e.g. http://localhost:3000): " origin
    if [ -n "$origin" ]; then
      replace_env_value "$env_file" "YEET2_CONTROL_ORIGIN" "$origin"
    fi

    read -rp "  LLM API key (OpenRouter or OpenAI): " llm_key
    if [ -n "$llm_key" ]; then
      replace_env_value "$env_file" "LLM_API_KEY" "$llm_key"
      replace_env_value "$env_file" "OPENROUTER_API_KEY" "$llm_key"
    fi

    read -rp "  LLM model (e.g. openrouter/openai/gpt-4.1-mini): " llm_model
    if [ -n "$llm_model" ]; then
      local brain_model="$llm_model"
      if [[ "$brain_model" != openrouter/* ]]; then
        brain_model="openrouter/$brain_model"
      fi
      replace_env_value "$env_file" "LLM_MODEL" "$llm_model"
      replace_env_value "$env_file" "YEET2_BRAIN_CREWAI_MODEL" "$brain_model"
    fi

    read -rp "  GitHub token (optional, for PR automation): " gh_token
    if [ -n "$gh_token" ]; then
      replace_env_value "$env_file" "GITHUB_TOKEN" "$gh_token"
    fi

    read -rsp "  Postgres password (leave blank for default 'yeet2'): " pg_pass
    echo ""
    if [ -n "$pg_pass" ]; then
      replace_env_value "$env_file" "POSTGRES_PASSWORD" "$pg_pass"
      replace_env_value "$env_file" "DATABASE_URL" "postgresql://yeet2:$pg_pass@localhost:5432/yeet2?schema=public"
    fi

    local api_token brain_token executor_token
    api_token=$(generate_token)
    brain_token=$(generate_token)
    executor_token=$(generate_token)
    replace_env_value "$env_file" "YEET2_API_BEARER_TOKEN" "$api_token"
    replace_env_value "$env_file" "YEET2_BRAIN_BEARER_TOKEN" "$brain_token"
    replace_env_value "$env_file" "YEET2_EXECUTOR_BEARER_TOKEN" "$executor_token"

    echo ""
  fi

  ok ".env configured."
}

# ── Docker Compose ────────────────────────────────────────────────────────────
start_stack() {
  local compose_args=("--env-file" "$INSTALL_DIR/.env" "-f" "$INSTALL_DIR/$COMPOSE_FILE")
  info "Building and starting services via $COMPOSE_FILE..."
  docker compose "${compose_args[@]}" up -d --build
  ok "Stack started."
}

wait_healthy() {
  info "Waiting for API health check..."
  local api_port
  api_port=$(grep '^API_PORT=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3001")
  api_port="${api_port:-3001}"
  local tries=0
  until curl -sf "http://localhost:${api_port}/health" &>/dev/null; do
    tries=$((tries + 1))
    [ $tries -ge 40 ] && { warn "API did not become healthy within 120s. Check: docker compose logs api"; break; }
    sleep 3
  done
  if curl -sf "http://localhost:${api_port}/health" &>/dev/null; then
    ok "API is healthy at http://localhost:${api_port}/health"
  fi
}

print_summary() {
  local control_port
  control_port=$(grep '^CONTROL_PORT=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")
  local origin
  origin=$(grep '^YEET2_CONTROL_ORIGIN=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "http://localhost:3000")

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  yeet2 is up!${NC}"
  echo ""
  echo -e "  Control UI → ${CYAN}${origin}${NC}"
  echo -e "  API        → ${CYAN}http://localhost:$(grep '^API_PORT=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 || echo 3001)/health${NC}"
  echo ""
  echo -e "  Logs:   docker compose -f $INSTALL_DIR/$COMPOSE_FILE logs -f"
  echo -e "  Update: bash $INSTALL_DIR/install.sh"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}  yeet2 installer${NC}"
  echo ""

  check_deps
  clone_or_update
  setup_env
  start_stack
  wait_healthy
  print_summary
}

main "$@"
