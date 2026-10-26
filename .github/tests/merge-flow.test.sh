#!/usr/bin/env bash
# Behaviour tests for the merge flow (A11-274): each case runs a workflow step's `run:` block AS IT IS WRITTEN in the YAML, so a broken
# `gh api` call, `jq` filter or shell test fails here, where a grep of the file's text would still pass.
#
#   - `auto-arm.yml`'s `relay` step: it passes while `main` has no copy of the file that takes a `pr`, and fails on any other refusal.
#   - `auto-arm.yml`'s `flow` step, in both jobs that arm: it may say `ready=true` only when `main`'s rules hold a merge queue, an approving
#     review and the required `gate`. On any other `main` an arm is an immediate merge, so the step must stay closed. `gh` is a stub that
#     prints a fixture of `GET repos/<repo>/rules/branches/main`, so nothing here reaches GitHub.
#   - `checks.yml`'s `gate` job: it passes only when `check` succeeded. A failed, skipped or cancelled `check` fails it, because a skipped
#     required check would otherwise count as passed.
#
# Run from the repository root: `bash .github/tests/merge-flow.test.sh`. Needs bash, jq and python3 with PyYAML (all on GitHub's Ubuntu runners).
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "${WORK:?}"' EXIT
failures=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; failures=$((failures + 1)); }

# The `run:` block of each step in <job> whose <key> is <value>, written to <out>.<n> (1, 2, ...); prints how many it wrote.
extract_runs() {
  python3 -I - "$@" <<'PY'
import sys, yaml
path, jobs, key, value, out = sys.argv[1:]
workflow = yaml.safe_load(open(path))
written = 0
for job in jobs.split(","):
    for step in workflow["jobs"][job]["steps"]:
        if step.get(key) == value:
            written += 1
            open(f"{out}.{written}", "w").write(step["run"])
print(written)
PY
}

# ---- auto-arm.yml: the `flow` guard ----------------------------------------------------------------------------------------------

mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
# A stand-in for `gh`. It answers exactly two calls and fails on anything else: the guard's read of `main`'s rules, from $RULES_FIXTURE,
# and `relay`'s dispatch to `main`'s copy of auto-arm.yml, which succeeds when $DISPATCH_ANSWER is empty and otherwise fails printing it.
if [ "$1" = workflow ]; then
  [ "$*" = "workflow run auto-arm.yml --repo ${REPOSITORY} --ref main -f pr=${PULL_REQUEST}" ] || { echo "unexpected gh call: $*" >&2; exit 2; }
  [ -z "${DISPATCH_ANSWER:-}" ] || { echo "$DISPATCH_ANSWER" >&2; exit 1; }
  exit 0
fi
[ "${GH_FAIL:-}" = 1 ] && { echo "gh: HTTP 502" >&2; exit 1; }
[ "$#" -eq 2 ] && [ "$1" = api ] && [ "$2" = "repos/${GH_REPO}/rules/branches/main" ] || { echo "unexpected gh call: $*" >&2; exit 2; }
cat "$RULES_FIXTURE"
STUB
chmod +x "$WORK/bin/gh"

merge_queue='{ "type": "merge_queue", "parameters": { "merge_method": "MERGE" } }'
review() { echo "{ \"type\": \"pull_request\", \"parameters\": { \"required_approving_review_count\": $1 } }"; }
checks() { echo "{ \"type\": \"required_status_checks\", \"parameters\": { \"required_status_checks\": [ { \"context\": \"$1\", \"integration_id\": 15368 } ] } }"; }
deletion='{ "type": "deletion" }'
no_force='{ "type": "non_fast_forward" }'

# name | rules JSON | whether the guard may open
guard_cases=(
  "the whole flow (announcement-emulator's rules)|[$merge_queue, $(review 1), $(checks gate), $deletion, $no_force]|open"
  "no rules at all (this repository before the admin acts)|[]|closed"
  "only main-protected (.github before the admin acts)|[$deletion, $no_force, $(review 1)]|closed"
  "no merge queue|[$(review 1), $(checks gate)]|closed"
  "no approving review required|[$merge_queue, $(review 0), $(checks gate)]|closed"
  "no review rule|[$merge_queue, $(checks gate)]|closed"
  "a required check that is not gate|[$merge_queue, $(review 1), $(checks build)]|closed"
  "no required checks|[$merge_queue, $(review 1)]|closed"
)

count=$(extract_runs "$ROOT/.github/workflows/auto-arm.yml" arm,arm-approved id flow "$WORK/flow")
if [ "$count" = 2 ]; then pass "auto-arm.yml has a flow step in arm and in arm-approved"; else fail "auto-arm.yml: expected 2 flow steps in arm and arm-approved, found $count"; fi

# Each step runs as Actions runs it: `bash -e`, with GITHUB_OUTPUT a file.
run_flow() { # <script> <fixture> [GH_FAIL] -> sets flow_rc and flow_output
  local output="$WORK/github-output"; : > "$output"
  PATH="$WORK/bin:$PATH" GH_REPO=a11ign/example RULES_FIXTURE="$2" GH_FAIL="${3:-}" GITHUB_OUTPUT="$output" \
    bash -e "$1" > "$WORK/flow-stdout" 2>&1
  flow_rc=$?
  flow_output=$(cat "$output")
}

for n in $(seq 1 "$count"); do
  for case in "${guard_cases[@]}"; do
    IFS='|' read -r name rules want <<<"$case"
    printf '%s\n' "$rules" > "$WORK/rules.json"
    run_flow "$WORK/flow.$n" "$WORK/rules.json"
    if [ "$want" = open ]; then
      [ "$flow_rc" = 0 ] && [ "$flow_output" = "ready=true" ] && pass "flow step $n opens on $name" \
        || fail "flow step $n should open on $name (exit $flow_rc, output '$flow_output')"
    else
      [ "$flow_rc" = 0 ] && [ -z "$flow_output" ] && grep -q '::notice::AUTO-ARM: main has no merge flow yet' "$WORK/flow-stdout" \
        && pass "flow step $n stays closed, with a notice, on $name" \
        || fail "flow step $n should stay closed with a notice on $name (exit $flow_rc, output '$flow_output')"
    fi
  done
  # A read that fails must not open the guard: the step fails (red, so it is seen) and writes nothing.
  run_flow "$WORK/flow.$n" "$WORK/rules.json" 1
  [ "$flow_rc" != 0 ] && [ -z "$flow_output" ] && pass "flow step $n fails closed when the rules cannot be read" \
    || fail "flow step $n should fail closed when the rules cannot be read (exit $flow_rc, output '$flow_output')"
done

# ---- auto-arm.yml: `relay` -----------------------------------------------------------------------------------------------------

# `relay` hands an approved pull request to `main`'s copy of auto-arm.yml. While `main` has no copy that takes a `pr` (none at all, before
# this file lands, or one with no `pr` input), there is nothing to hand it to: that is not the pull request's failure, so the job passes
# with a notice. Any other refusal stays red.
count=$(extract_runs "$ROOT/.github/workflows/auto-arm.yml" relay name "Hand the approved pull request to \`main\`'s copy of this workflow (#4969)" "$WORK/relay")
if [ "$count" = 1 ]; then pass "auto-arm.yml's relay job has its one step"; else fail "auto-arm.yml: expected 1 relay step, found $count"; fi

# name | what GitHub answers the dispatch ("" is success) | the exit relay must end with
relay_cases=(
  "main's copy took the dispatch||0"
  "main has no copy of auto-arm.yml yet|could not create workflow dispatch event: HTTP 422: Workflow does not have 'workflow_dispatch' trigger (https://api.github.com/repos/a11ign/example/actions/workflows/1/dispatches)|0"
  "main's copy declares no pr input yet|could not create workflow dispatch event: HTTP 422: Unexpected inputs provided: [\"pr\"]|0"
  "any other refusal|could not create workflow dispatch event: HTTP 403: Resource not accessible by integration|nonzero"
)
for case in "${relay_cases[@]}"; do
  IFS='|' read -r name answer want <<<"$case"
  PATH="$WORK/bin:$PATH" REPOSITORY=a11ign/example PULL_REQUEST=7 DISPATCH_ANSWER="$answer" bash -e "$WORK/relay.1" > "$WORK/relay-stdout" 2>&1
  rc=$?
  if [ "$want" = 0 ]; then
    [ "$rc" = 0 ] && pass "relay passes when $name" || fail "relay should pass when $name (exit $rc: $(tail -1 "$WORK/relay-stdout"))"
  else
    [ "$rc" != 0 ] && pass "relay fails on $name" || fail "relay should fail on $name (exit 0)"
  fi
done

# ---- checks.yml: the `gate` job --------------------------------------------------------------------------------------------------

count=$(extract_runs "$ROOT/.github/workflows/checks.yml" gate name "Every job ran, and ran clean" "$WORK/gate")
if [ "$count" = 1 ]; then pass "checks.yml's gate job has its one step"; else fail "checks.yml: expected 1 gate step, found $count"; fi
needs=$(python3 -I -c 'import sys,yaml; print(",".join(yaml.safe_load(open(sys.argv[1]))["jobs"]["gate"]["needs"]))' "$ROOT/.github/workflows/checks.yml")
[ "$needs" = check ] && pass "gate needs check" || fail "gate should need check, needs '$needs'"

for result in success failure skipped cancelled; do
  # What Actions substitutes for the expression before the shell sees it.
  sed "s/\${{ needs\.check\.result }}/$result/g" "$WORK/gate.1" > "$WORK/gate-$result.sh"
  bash -e "$WORK/gate-$result.sh" > /dev/null 2>&1; rc=$?
  if [ "$result" = success ]; then
    [ "$rc" = 0 ] && pass "gate passes when check succeeded" || fail "gate should pass when check succeeded (exit $rc)"
  else
    [ "$rc" != 0 ] && pass "gate fails when check was $result" || fail "gate should fail when check was $result (exit 0)"
  fi
done

echo
if [ "$failures" -eq 0 ]; then echo "merge-flow tests: all passed"; else echo "merge-flow tests: $failures failed"; fi
[ "$failures" -eq 0 ]
