#!/usr/bin/env bash
# Temporary test script for resetting this checkout to origin/main, removing
# linked worktrees, and leaving only the expected minimal files in place. Do not
# touch, modify, or copy this file to other worktrees; it exists only for this
# temporary test flow.
set -euo pipefail

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
UPSTREAM="$REMOTE/$BRANCH"
KEEP_A="ARCHITECTURE.md"
KEEP_B="PROJECT.md"
SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

usage() {
  cat <<USAGE
Usage: ./reset-to-remote-main.sh --yes

Destructively resets this repository to $UPSTREAM, removes linked worktrees,
cleans untracked files, and verifies only the Git metadata plus these files remain:
  - $KEEP_A
  - $KEEP_B
  - $SCRIPT_NAME

Override the target with REMOTE=<name> BRANCH=<name>.
If Git metadata is missing or damaged, repair it first with:
  git init
  git remote add origin <repo-url>
  git fetch origin main
USAGE
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  echo
  echo "Refusing to run without --yes."
  exit 2
fi

cd "$SCRIPT_DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "This directory does not contain valid Git metadata." >&2
  echo "Refusing to clean files because .git is missing or damaged." >&2
  echo "Repair .git first, then rerun this script." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

script_backup="$(mktemp)"
cp "$SCRIPT_NAME" "$script_backup"
trap 'rm -f "$script_backup"' EXIT

echo "Repository: $repo_root"
echo "Target:     $UPSTREAM"
echo

echo "Fetching $UPSTREAM..."
git fetch "$REMOTE" "$BRANCH"

if ! git show-ref --verify --quiet "refs/remotes/$UPSTREAM"; then
  echo "Remote branch refs/remotes/$UPSTREAM does not exist." >&2
  exit 1
fi

echo "Removing linked worktrees..."
current_worktree="$(pwd -P)"
while IFS= read -r worktree_path; do
  [[ -z "$worktree_path" ]] && continue
  if [[ "$(cd "$worktree_path" 2>/dev/null && pwd -P)" == "$current_worktree" ]]; then
    continue
  fi
  echo "  removing $worktree_path"
  git worktree remove --force "$worktree_path"
done < <(git worktree list --porcelain | awk '/^worktree / {print substr($0, 10)}')

git worktree prune

echo "Switching to $BRANCH..."
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git switch --force "$BRANCH"
else
  git switch --create "$BRANCH" --track "$UPSTREAM"
fi

echo "Resetting to $UPSTREAM..."
git reset --hard "$UPSTREAM"

echo "Cleaning untracked and ignored files..."
git clean -fdx -e "$SCRIPT_NAME"

echo "Restoring this reset script..."
cp "$script_backup" "$SCRIPT_NAME"
chmod +x "$SCRIPT_NAME"

echo "Enforcing repository contents..."
git ls-files -z | while IFS= read -r -d '' path; do
  case "$path" in
    "$KEEP_A"|"$KEEP_B"|"$SCRIPT_NAME") ;;
    *) git rm -f -- "$path" ;;
  esac
done

find . -mindepth 1 -maxdepth 1 \
  ! -name .git \
  ! -name "$KEEP_A" \
  ! -name "$KEEP_B" \
  ! -name "$SCRIPT_NAME" \
  -exec rm -rf -- {} +

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Git metadata became invalid during cleanup." >&2
  exit 1
fi

echo
echo "Final status:"
git status --short --branch

remaining_files="$(find . -path ./.git -prune -o -type f -print | sort)"
expected_files="./$KEEP_A
./$KEEP_B
./$SCRIPT_NAME"

if [[ "$remaining_files" != "$expected_files" ]]; then
  echo "Unexpected files remain:" >&2
  printf '%s\n' "$remaining_files" >&2
  exit 1
fi

echo
echo "Done. Only .git, $KEEP_A, $KEEP_B, and $SCRIPT_NAME remain."
