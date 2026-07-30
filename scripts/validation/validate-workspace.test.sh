#!/bin/sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
VALIDATOR="$PROJECT_ROOT/scripts/validation/validate-workspace.sh"
output_file=$(mktemp "${TMPDIR:-/tmp}/validate-workspace.XXXXXX")
zero_file="$PROJECT_ROOT/.validate-workspace-test-$$"

cleanup() {
  rm -f "$output_file" "$zero_file"
}

trap cleanup EXIT HUP INT TERM

if ! sh "$VALIDATOR" >"$output_file" 2>&1; then
  cat "$output_file" >&2
  exit 1
fi

: >"$zero_file"
if sh "$VALIDATOR" >"$output_file" 2>&1; then
  printf 'expected the validator to reject a project-owned zero-byte file\n' >&2
  exit 1
fi

grep -F "./$(basename "$zero_file")" "$output_file" >/dev/null || {
  cat "$output_file" >&2
  exit 1
}
