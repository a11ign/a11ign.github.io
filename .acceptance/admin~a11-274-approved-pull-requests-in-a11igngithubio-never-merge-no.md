A11-274, step 1 of 4 (a11ign.github.io): the merge flow A11-237 gave announcement-emulator. `checks.yml` now also runs on `merge_group` and on a body edit (`edited`), and has a job `gate` that needs `check` and fails unless it succeeded: the check the `merge-queue-main` ruleset requires. `.github/workflows/auto-arm.yml` arms every open, non-draft, unheld pull request, and an approving review marks a draft ready and arms it. `.github/chainguard/auto-arm.sts.yaml` is its Octo STS policy, bound to this repository's immutable id and to `main`'s `auto-arm.yml`. `.github/rulesets/merge-queue-main.json` is the ruleset, byte-identical to announcement-emulator's. The ruleset and `allow_auto_merge` take effect when the chairman session applies them after merge (the pull request body has the commands).

Acceptance:

```bash
set -euo pipefail
# every changed workflow file is valid
for f in .github/workflows/checks.yml .github/workflows/auto-arm.yml; do npx --yes @action-validator/cli@0.6.0 "$f"; done
# the ruleset is byte-identical to announcement-emulator's
cmp .github/rulesets/merge-queue-main.json <(gh api repos/a11ign/announcement-emulator/contents/.github/rulesets/merge-queue-main.json --jq .content | base64 -d)
# auto-arm.yml is announcement-emulator's, line for line, once comments are set aside
diff <(grep -v '^ *#' .github/workflows/auto-arm.yml) <(gh api repos/a11ign/announcement-emulator/contents/.github/workflows/auto-arm.yml --jq .content | base64 -d | grep -v '^ *#')
# the policy's subject names this repository's own immutable id, and its workflow is main's auto-arm.yml
id=$(gh api repos/a11ign/a11ign.github.io --jq .id)
grep -qxF "subject_pattern: repo:a11ign@320310787/a11ign\.github\.io@${id}:(pull_request|ref:refs/heads/main)" .github/chainguard/auto-arm.sts.yaml
grep -qxF '  job_workflow_ref: a11ign/a11ign\.github\.io/\.github/workflows/auto-arm\.yml@refs/heads/main' .github/chainguard/auto-arm.sts.yaml
# gate runs in the merge queue and on a body edit, and needs check
grep -qx '  merge_group:' .github/workflows/checks.yml
grep -qx '    types: \[opened, synchronize, reopened, edited\]' .github/workflows/checks.yml
grep -qx '  gate:' .github/workflows/checks.yml
grep -qx '    needs: \[check\]' .github/workflows/checks.yml
# gate ran green on this head
test "$(gh api "repos/a11ign/a11ign.github.io/commits/$(git rev-parse HEAD)/check-runs?check_name=gate" --jq '.check_runs[0].conclusion')" = success
# the site's own checks stay green
npm ci
npm run check
```
