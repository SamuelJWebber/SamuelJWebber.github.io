# Contribute or challenge a result

Start with the public source snapshot and its `SOURCE_MANIFEST.json`. Use
`REPORT_TEMPLATE.md` to report a factual, data, statistical or software issue.
A useful challenge names the exact contract/event, quote timestamp, source
release, assumption or line of code and explains how it changes the result.

## Reproduce first

1. Record the source snapshot ID, data-file hashes and relevant dashboard URL.
2. Verify the source: `python scripts/check_source_bundle.py --directory .`.
3. Restore the smallest relevant inputs using `scripts/restore_public_data.py`.
4. Run the study's documented command in an isolated environment. Record the
   command, dependency versions, observed result and expected result.
5. Separate a source-data correction from a changed statistical definition.
   Show the original and proposed calculation on the same observations when
   possible, and disclose any changed inclusion rules or sample size.

Useful challenges include missing contracts, incorrect YES/NO mappings, revised
versus first-release data, post-news prices, stale trade/quote selection, event
clustering, dependence across releases, lookahead, changed sample composition,
multiple testing and incorrect units or licensing attribution.

## Propose a code change

There is currently **no public issue tracker or pull-request endpoint** attached
to this Site. Downloading the source does not grant write access to the hosted
project. You can import the snapshot into a repository you control and prepare
a reviewable patch:

```sh
git init
git add .
git commit -m "Import Atlas source snapshot"
git switch -c improve-study
# Make and check your changes, then stage them (including new files):
git add .
git diff --cached --binary > ../atlas-proposed-change.patch
```

The command writes the patch outside the repository. Share it, the completed report and relevant
output with the project author through a channel you already use. The dashboard
links [Samuel Webber's LinkedIn](https://www.linkedin.com/in/samuelwebber) as a
public profile; it is not an automated submission or review system. No report
or message is sent by this website.

For a fork you host, state the originating snapshot ID, identify your changes,
retain source/data notices and distinguish newly collected data from the frozen
published snapshot. Do not upload private lending records, account identifiers,
API keys or customer information to a public fork.

## Review criteria

- Preserve raw observations and provenance; show exclusions and failed requests.
- Use information available at the forecast timestamp and a defined outcome.
- Report contracts, underlying releases/events and eligible observations.
- Match cohorts when comparing horizons, prices or methods.
- Show uncertainty only when the effective sample supports it.
- Clearly separate an exploratory relationship from a held-out improvement.
- Keep public data separate from any proprietary application or lender pilot.
- Check the affected calculation and browser behavior; do not silently refresh
  unrelated data while making a presentation or code correction.
