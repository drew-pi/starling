#!/usr/bin/env bash
set -euo pipefail

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
UPSTREAM="$REMOTE/$BRANCH"
KEEP_A="ARCHITECTURE.md"
KEEP_B="PROJECT.md"

usage() {
  cat <<USAGE
Usage: ./reset-to-remote-main.sh --yes

Destructively resets this repository to $UPSTREAM, removes linked worktrees,
cleans untracked files, and verifies only these files remain:
  - $KEEP_A
  - $KEEP_B

Override the target with REMOTE=<name> BRANCH=<name>.
USAGE
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  echo
  echo "Refusing to run without --yes."
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

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
git clean -fdx

echo "Enforcing two-file repo contents..."
git ls-files -z | while IFS= read -r -d '' path; do
  case "$path" in
    "$KEEP_A"|"$KEEP_B") ;;
    *) git rm -f -- "$path" ;;
  esac
done

find . \
  -path ./.git -prune -o \
  -type f \
  ! -path "./$KEEP_A" \
  ! -path "./$KEEP_B" \
  -print -delete

echo
echo "Final status:"
git status --short --branch

remaining_files="$(find . -path ./.git -prune -o -type f -print | sort)"
expected_files="./$KEEP_A
./$KEEP_B"

if [[ "$remaining_files" != "$expected_files" ]]; then
  echo "Unexpected files remain:" >&2
  printf '%s\n' "$remaining_files" >&2
  exit 1
fi

echo
echo "Done. Only $KEEP_A and $KEEP_B remain."
