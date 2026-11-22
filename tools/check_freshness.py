#!/usr/bin/env python3
"""Evaluate portfolio dashboard freshness and render HTML/Markdown summaries.

Reads a committed ``data/portfolio_status.json`` manifest using Python's
standard library only (zero external dependencies, zero network calls).
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
from pathlib import Path
import sys
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "data" / "portfolio_status.json"
DEFAULT_INDEX = REPO_ROOT / "index.html"

START_MARKER = "<!-- FRESHNESS:START -->"
END_MARKER = "<!-- FRESHNESS:END -->"

STATUS_LABELS = {
    "current": "Current",
    "snapshot": "Snapshot",
    "frozen": "Frozen",
    "stale": "Stale",
}


def parse_iso_date(value: str) -> dt.date:
    """Parse an ISO-8601 date (YYYY-MM-DD) into a ``datetime.date``."""
    return dt.date.fromisoformat(value)


def load_manifest(path: Path = DEFAULT_MANIFEST) -> dict[str, Any]:
    """Load and validate basic structure of the portfolio status manifest."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if "dashboards" not in raw or not isinstance(raw["dashboards"], list):
        raise ValueError("Manifest must contain a 'dashboards' list")
    if "verified_at" not in raw:
        raise ValueError("Manifest must contain 'verified_at'")
    return raw


def evaluate_dashboard(entry: dict[str, Any], as_of: dt.date) -> dict[str, Any]:
    """Compute freshness status and age metrics for a single dashboard entry."""
    commit_date = parse_iso_date(entry["latest_commit_date"])
    snapshot_date = parse_iso_date(entry["snapshot_date"])
    commit_age_days = (as_of - commit_date).days
    snapshot_age_days = (as_of - snapshot_date).days

    status_mode = entry["status_mode"]
    max_age_days = entry.get("max_age_days")
    sync_due_after_raw = entry.get("sync_due_after")
    sync_due_after = parse_iso_date(sync_due_after_raw) if sync_due_after_raw else None

    state = status_mode
    stale_reason: str | None = None

    if status_mode == "active":
        state = "current"
        if max_age_days is not None and commit_age_days > max_age_days:
            state = "stale"
            stale_reason = (
                f"last commit {commit_age_days}d ago exceeds {max_age_days}d cadence"
            )
        elif sync_due_after is not None and as_of > sync_due_after and commit_date < sync_due_after:
            state = "stale"
            stale_reason = f"monthly sync overdue after {sync_due_after.isoformat()}"
    elif status_mode not in ("snapshot", "frozen"):
        raise ValueError(f"Unsupported status_mode {status_mode!r} for {entry.get('id')}")

    return {
        **entry,
        "state": state,
        "state_label": STATUS_LABELS[state],
        "commit_age_days": commit_age_days,
        "snapshot_age_days": snapshot_age_days,
        "stale_reason": stale_reason,
    }


def evaluate_deadline(deadline: dict[str, Any], as_of: dt.date) -> dict[str, Any]:
    """Compute relative window label for an upcoming deadline or release watch."""
    target = parse_iso_date(deadline["date"])
    delta_days = (target - as_of).days
    if delta_days < 0:
        window = f"overdue {abs(delta_days)}d"
    elif delta_days == 0:
        window = "today"
    else:
        window = f"in {delta_days}d"
    return {**deadline, "delta_days": delta_days, "window": window}


def evaluate_portfolio(
    manifest: dict[str, Any],
    as_of: dt.date | None = None,
) -> dict[str, Any]:
    """Evaluate all dashboards and upcoming deadlines as of ``as_of``."""
    verified_at = parse_iso_date(manifest["verified_at"])
    effective_date = as_of or verified_at

    dashboards = [evaluate_dashboard(item, effective_date) for item in manifest["dashboards"]]
    deadlines = sorted(
        (evaluate_deadline(item, effective_date) for item in manifest.get("upcoming_deadlines", [])),
        key=lambda row: (row["date"], row["repo"], row["title"]),
    )
    stale_ids = [item["id"] for item in dashboards if item["state"] == "stale"]

    return {
        "as_of": effective_date.isoformat(),
        "verified_at": verified_at.isoformat(),
        "stale_ids": stale_ids,
        "healthy": len(stale_ids) == 0,
        "dashboards": dashboards,
        "deadlines": deadlines,
    }


def _md_cell(text: str) -> str:
    """Escape Markdown table cell separators and line breaks."""
    return " ".join(str(text).replace("|", "\\|").splitlines())


def render_markdown(report: dict[str, Any]) -> str:
    """Render a clean Markdown Portfolio Drift & Upcoming Deadlines digest."""
    lines = [
        "## Portfolio Drift & Upcoming Deadlines",
        "",
        (
            f"As of `{report['as_of']}` (manifest verified `{report['verified_at']}`; "
            f"stale scheduled dashboards: {len(report['stale_ids'])})."
        ),
        "",
        "| Dashboard | Cadence | Latest Commit | Snapshot | Status | Drift & Release Watch |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for item in report["dashboards"]:
        link = f"[{_md_cell(item['name'])}]({item['live_url']})"
        commit_col = f"`{item['latest_commit_date']}` (`{item['latest_commit_sha']}`)"
        snap_col = f"`{item['snapshot_date']}`"
        note = item["drift_note"]
        if item["stale_reason"]:
            note = f"{note} [ALERT: {item['stale_reason']}]"
        lines.append(
            "| "
            + " | ".join(
                [
                    link,
                    _md_cell(item["cadence_label"]),
                    commit_col,
                    snap_col,
                    _md_cell(item["state_label"]),
                    _md_cell(note),
                ]
            )
            + " |"
        )

    if report["deadlines"]:
        lines.extend(
            [
                "",
                "### Upcoming Deadlines & Release Watch",
                "",
                "| Date | Window | Repo | Item | Note |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for row in report["deadlines"]:
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{row['date']}`",
                        _md_cell(row["window"]),
                        f"`{_md_cell(row['repo'])}`",
                        _md_cell(row["title"]),
                        _md_cell(row["note"]),
                    ]
                )
                + " |"
            )

    return "\n".join(lines) + "\n"


def render_html_section(report: dict[str, Any], include_unlisted: bool = False) -> str:
    """Render the self-contained HTML freshness section for ``index.html``."""
    rows_html: list[str] = []
    for item in report["dashboards"]:
        if not include_unlisted and not item.get("hub_listed", True):
            continue
        href = html.escape(item["href"], quote=True)
        name = html.escape(item["name"], quote=True)
        cadence = html.escape(item["cadence_label"], quote=True)
        snapshot = html.escape(item["snapshot_date"], quote=True)
        state = html.escape(item["state"], quote=True)
        state_label = html.escape(item["state_label"], quote=True)
        note_text = item["drift_note"]
        if item["stale_reason"]:
            note_text = f"{note_text} ({item['stale_reason']})"
        note = html.escape(note_text, quote=True)

        rows_html.append(
            "        <tr>\n"
            f'          <td class="f-name"><a href="{href}">{name}</a></td>\n'
            f"          <td>{cadence}</td>\n"
            f'          <td class="f-date"><time datetime="{snapshot}">{snapshot}</time></td>\n'
            f'          <td><span class="badge badge-{state}">{state_label}</span></td>\n'
            f'          <td class="f-note">{note}</td>\n'
            "        </tr>"
        )

    verified = html.escape(report["verified_at"], quote=True)
    body = "\n".join(rows_html)
    return (
        '<section class="freshness" aria-labelledby="freshness-heading">\n'
        '  <div class="freshness-head">\n'
        '    <h2 id="freshness-heading">Freshness &amp; cadence</h2>\n'
        f'    <p class="freshness-meta">Public snapshot dates and update schedules, verified <time datetime="{verified}">{verified}</time>.</p>\n'
        "  </div>\n"
        '  <div class="table-wrap">\n'
        '    <table class="fresh-table">\n'
        "      <thead>\n"
        "        <tr>\n"
        '          <th scope="col">Dashboard</th>\n'
        '          <th scope="col">Cadence</th>\n'
        '          <th scope="col">Snapshot</th>\n'
        '          <th scope="col">Status</th>\n'
        '          <th scope="col">Drift &amp; release watch</th>\n'
        "        </tr>\n"
        "      </thead>\n"
        "      <tbody>\n"
        f"{body}\n"
        "      </tbody>\n"
        "    </table>\n"
        "  </div>\n"
        "</section>"
    )


def update_index_html(index_path: Path, section_html: str) -> bool:
    """Replace the marked freshness block in ``index.html``; return True if changed."""
    content = index_path.read_text(encoding="utf-8")
    start_idx = content.find(START_MARKER)
    end_idx = content.find(END_MARKER)
    if start_idx == -1 or end_idx == -1 or end_idx < start_idx:
        raise ValueError(
            f"{index_path} must contain {START_MARKER!r} and {END_MARKER!r} markers"
        )

    replacement = f"{START_MARKER}\n{section_html}\n{END_MARKER}"
    updated = content[:start_idx] + replacement + content[end_idx + len(END_MARKER) :]
    if updated == content:
        return False
    index_path.write_bytes(updated.encode("utf-8"))
    return True


def build_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Check portfolio dashboard freshness and generate HTML/Markdown summaries."
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Path to portfolio_status.json manifest.",
    )
    parser.add_argument(
        "--as-of",
        type=parse_iso_date,
        default=None,
        help="Evaluation date (YYYY-MM-DD). Defaults to manifest verified_at.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "html", "json", "all"),
        default="markdown",
        help="Output format (default: markdown).",
    )
    parser.add_argument(
        "--update-index",
        action="store_true",
        help="Sync the freshness block inside index.html from the manifest.",
    )
    parser.add_argument(
        "--index",
        type=Path,
        default=DEFAULT_INDEX,
        help="Path to index.html used with --update-index.",
    )
    parser.add_argument(
        "--no-fail",
        action="store_true",
        help="Exit 0 even when scheduled dashboards are stale.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint; returns 0 when all scheduled dashboards are current, else 1."""
    args = build_parser().parse_args(argv)
    manifest = load_manifest(args.manifest)
    report = evaluate_portfolio(manifest, as_of=args.as_of)

    if args.update_index:
        section_html = render_html_section(report)
        update_index_html(args.index, section_html)

    if args.format == "markdown":
        sys.stdout.write(render_markdown(report))
    elif args.format == "html":
        sys.stdout.write(render_html_section(report) + "\n")
    elif args.format == "json":
        sys.stdout.write(json.dumps(report, indent=2) + "\n")
    elif args.format == "all":
        sys.stdout.write(render_markdown(report))
        sys.stdout.write("\n<!-- HTML SNIPPET -->\n")
        sys.stdout.write(render_html_section(report) + "\n")

    if not args.no_fail and not report["healthy"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
