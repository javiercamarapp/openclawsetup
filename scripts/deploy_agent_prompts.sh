#!/usr/bin/env bash
# deploy_agent_prompts.sh — Bloque 2 polish
#
# Copies every agents/<name>/AGENTS.md in this repo to
# ~/.openclaw/agents/<name>/workspace/AGENTS.md on the Mac Mini where
# OpenClaw is installed. Idempotent by default: if a destination file
# already exists and its content differs from the repo version, the
# script refuses to overwrite it unless --force is passed. This
# protects any hand-edits the operator may have made directly in the
# workspace.
#
# Usage:
#   bash scripts/deploy_agent_prompts.sh             # deploy new + unchanged
#   bash scripts/deploy_agent_prompts.sh --dry-run   # preview only
#   bash scripts/deploy_agent_prompts.sh --force     # clobber existing
#
# Exit codes:
#   0  success (all operations completed)
#   1  argument / usage error
#   2  prerequisite missing (OpenClaw not installed, agents dir missing)
#   3  destination conflict (add --force to override)
#
# Read-only against OpenClaw (never invokes `openclaw` itself; only
# manipulates files under ~/.openclaw/agents/<name>/workspace/).

set -euo pipefail

# ── arg parsing ────────────────────────────────────────────────────
DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    -h|--help)
      sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "[deploy_agent_prompts] unknown arg: $arg" >&2
      echo "use --help for usage" >&2
      exit 1
      ;;
  esac
done

# ── locate repo root and source dir ───────────────────────────────
# Resolve the repo root as the parent of this script's directory,
# so the script works no matter where it is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_SRC="$REPO_ROOT/agents"
OPENCLAW_ROOT="${OPENCLAW_ROOT:-$HOME/.openclaw}"
AGENTS_DST_ROOT="$OPENCLAW_ROOT/agents"

if [[ ! -d "$AGENTS_SRC" ]]; then
  echo "[deploy_agent_prompts] source dir missing: $AGENTS_SRC" >&2
  exit 2
fi

if [[ ! -d "$AGENTS_DST_ROOT" ]]; then
  echo "[deploy_agent_prompts] OpenClaw not installed: $AGENTS_DST_ROOT does not exist" >&2
  echo "[deploy_agent_prompts] set OPENCLAW_ROOT env var if OpenClaw lives elsewhere" >&2
  exit 2
fi

# ── counters ─────────────────────────────────────────────────────
copied=0
skipped_identical=0
skipped_missing_src=0
skipped_no_workspace=0
conflicts=0
errors=0

mode_label="real"
[[ $DRY_RUN -eq 1 ]] && mode_label="dry-run"
echo "[deploy_agent_prompts] mode=$mode_label force=$FORCE"
echo "[deploy_agent_prompts] source: $AGENTS_SRC"
echo "[deploy_agent_prompts] dest:   $AGENTS_DST_ROOT"
echo

# ── walk each agent subdirectory ─────────────────────────────────
# Iterate over directories only, and skip entries whose basename
# starts with '_' (reserved for the _TEMPLATE.md reference) or '.'.
shopt -s nullglob
for dir in "$AGENTS_SRC"/*/; do
  name="$(basename "$dir")"
  case "$name" in
    _*|.*) continue ;;
  esac

  src="$AGENTS_SRC/$name/AGENTS.md"
  dst_dir="$AGENTS_DST_ROOT/$name/workspace"
  dst="$dst_dir/AGENTS.md"

  if [[ ! -f "$src" ]]; then
    echo "  ~  $name — skip (source AGENTS.md missing)"
    skipped_missing_src=$((skipped_missing_src + 1))
    continue
  fi

  if [[ ! -d "$dst_dir" ]]; then
    echo "  !  $name — skip (workspace dir missing: $dst_dir)"
    skipped_no_workspace=$((skipped_no_workspace + 1))
    errors=$((errors + 1))
    continue
  fi

  if [[ -f "$dst" ]]; then
    if cmp -s "$src" "$dst"; then
      echo "  =  $name — identical, skip"
      skipped_identical=$((skipped_identical + 1))
      continue
    fi

    if [[ $FORCE -ne 1 ]]; then
      echo "  ✗  $name — CONFLICT: destination differs from source"
      echo "       src: $src"
      echo "       dst: $dst"
      echo "       use --force to overwrite, or port edits back into the repo first"
      conflicts=$((conflicts + 1))
      continue
    fi
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    if [[ -f "$dst" ]]; then
      echo "  →  $name — would overwrite (force)"
    else
      echo "  →  $name — would create"
    fi
  else
    cp "$src" "$dst"
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
      echo "  ✓  $name — deployed"
    else
      echo "  ✗  $name — cp succeeded but verification failed"
      errors=$((errors + 1))
      continue
    fi
  fi
  copied=$((copied + 1))
done
shopt -u nullglob

# ── summary ──────────────────────────────────────────────────────
echo
echo "[deploy_agent_prompts] summary:"
echo "  copied=$copied"
echo "  skipped_identical=$skipped_identical"
echo "  skipped_missing_src=$skipped_missing_src"
echo "  skipped_no_workspace=$skipped_no_workspace"
echo "  conflicts=$conflicts"
echo "  errors=$errors"

if [[ $conflicts -gt 0 ]]; then
  echo "[deploy_agent_prompts] $conflicts conflict(s) — re-run with --force to overwrite"
  exit 3
fi

if [[ $errors -gt 0 ]]; then
  echo "[deploy_agent_prompts] $errors error(s) — see messages above"
  exit 2
fi

echo "[deploy_agent_prompts] done"
