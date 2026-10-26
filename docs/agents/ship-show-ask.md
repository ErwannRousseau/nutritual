# Ship / Show / Ask

Choose the delivery path per change. `main` is the only long-lived branch.
Delete short-lived branches after their pull requests are merged.

| Path     | Use it for                                                        | GitHub flow                                                                                                                                                            |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ship** | Small, low-risk changes that follow an established pattern        | Commit directly to `main`.                                                                                                                                             |
| **Show** | Changes worth sharing, where feedback must not delay delivery     | Open a PR from a short-lived branch, add the `show` label, check the diff and checks, then merge. Invite feedback in the PR after merging.                             |
| **Ask**  | A change whose approach needs feedback before it is safe to merge | Open a PR from a short-lived branch, add the `ask` label, and do not merge until the requested feedback has been addressed or you have recorded a decision to proceed. |

Use the matching label on every PR. A PR without `ask` is not waiting for
approval. Do not require a self-review. Keep branches short-lived and keep
`main` releasable. Use existing automated checks where available.

Prefer Ship for routine work. Use Show to share a useful implementation or
decision. Use Ask when another perspective can change the plan or prevent a
costly mistake. Ask early when the uncertainty is about the approach, instead of
waiting until the implementation is complete.

GitHub has `show` and `ask` labels and uses this pull request template. The
active `main-integrity` ruleset prevents deleting `main`, force-pushing it, and
adding merge commits. Squash and rebase merges are enabled, and GitHub deletes
merged head branches automatically.

The ruleset does not require a pull request or status checks, so Ship can still
commit directly to `main`. The labels and the Ask feedback decision remain
workflow conventions. GitHub does not currently enforce that exactly one label
is present or that Ask feedback is addressed before merging.
