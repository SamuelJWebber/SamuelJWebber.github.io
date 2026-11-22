"""Offline unit tests for portfolio freshness logic, HTML validity, and CLI output."""

from __future__ import annotations

import contextlib
import datetime as dt
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import check_freshness as cf  # noqa: E402

VOID_HTML_TAGS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
)


class _StrictTagValidator(HTMLParser):
    """Verify HTML tags are properly nested and closed."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() not in VOID_HTML_TAGS:
            self.stack.append(tag.lower())

    def handle_endtag(self, tag: str) -> None:
        lower = tag.lower()
        if lower in VOID_HTML_TAGS:
            return
        if not self.stack or self.stack[-1] != lower:
            self.errors.append(
                f"Mismatched closing tag </{lower}>; stack={self.stack}"
            )
            return
        self.stack.pop()

    def validate(self, html_text: str) -> None:
        self.feed(html_text)
        self.close()
        if self.stack:
            self.errors.append(f"Unclosed tags remaining: {self.stack}")
        if self.errors:
            raise AssertionError("; ".join(self.errors))


class TestPortfolioFreshness(unittest.TestCase):
    """Verify manifest schema, date math, HTML rendering, and CLI behavior."""

    def setUp(self) -> None:
        self.manifest = cf.load_manifest()

    def test_manifest_schema_and_hub_card_parity(self) -> None:
        required_fields = {
            "id",
            "name",
            "href",
            "live_url",
            "source_repo",
            "publish_mode",
            "hub_listed",
            "cadence_label",
            "status_mode",
            "snapshot_date",
            "latest_commit_date",
            "latest_commit_sha",
            "drift_note",
        }
        seen_ids: set[str] = set()
        for entry in self.manifest["dashboards"]:
            missing = required_fields - set(entry)
            self.assertFalse(missing, f"Missing keys in {entry.get('id')}: {missing}")
            self.assertNotIn(entry["id"], seen_ids)
            seen_ids.add(entry["id"])
            cf.parse_iso_date(entry["snapshot_date"])
            cf.parse_iso_date(entry["latest_commit_date"])

        index_html = (REPO_ROOT / "index.html").read_text(encoding="utf-8")
        card_hrefs = re.findall(r'<a\s+class="card"\s+href="([^"]+)"', index_html)
        manifest_hub_hrefs = [
            item["href"] for item in self.manifest["dashboards"] if item["hub_listed"]
        ]
        self.assertEqual(len(card_hrefs), 8)
        self.assertEqual(card_hrefs, manifest_hub_hrefs)

    def test_freshness_math_at_verified_date_and_future_dates(self) -> None:
        with mock.patch("socket.socket", side_effect=AssertionError("No network calls")):
            verified = cf.evaluate_portfolio(self.manifest, as_of=dt.date(2026, 11, 22))
            self.assertTrue(verified["healthy"])
            self.assertEqual(verified["stale_ids"], [])

            by_id = {d["id"]: d for d in verified["dashboards"]}
            self.assertEqual(by_id["credit-card-data"]["state"], "current")
            self.assertEqual(by_id["abs-risk"]["state"], "current")
            self.assertEqual(by_id["citibike-dashboard"]["state"], "current")
            self.assertEqual(by_id["sale-shortlist"]["state"], "current")
            self.assertEqual(by_id["ski-rentals-2027"]["state"], "frozen")
            self.assertEqual(by_id["market-calibration-atlas"]["state"], "snapshot")
            self.assertEqual(by_id["curb-report"]["state"], "snapshot")

            deadlines = {(d["date"], d["repo"]): d for d in verified["deadlines"]}
            self.assertEqual(deadlines[("2026-11-19", "credit-card-data")]["window"], "overdue 3d")
            self.assertEqual(deadlines[("2026-11-27", "sale-shortlist")]["window"], "in 5d")
            self.assertEqual(deadlines[("2026-12-10", "ski-rentals-2027")]["window"], "in 18d")

            # After 3 days without refresh, 2-day nightly/hourly repos become stale,
            # while 7-day abs-risk, 40-day citibike, and static/frozen snapshots stay non-stale.
            day3 = cf.evaluate_portfolio(self.manifest, as_of=dt.date(2026, 11, 25))
            self.assertFalse(day3["healthy"])
            self.assertEqual(day3["stale_ids"], ["credit-card-data", "sale-shortlist"])

            # On 2026-12-14 citibike sync is not overdue yet; on 2026-12-15 it becomes stale.
            on_14th = cf.evaluate_portfolio(self.manifest, as_of=dt.date(2026, 12, 14))
            on_14th_cb = next(d for d in on_14th["dashboards"] if d["id"] == "citibike-dashboard")
            self.assertEqual(on_14th_cb["state"], "current")

            after_14th = cf.evaluate_portfolio(self.manifest, as_of=dt.date(2026, 12, 15))
            after_14th_cb = next(
                d for d in after_14th["dashboards"] if d["id"] == "citibike-dashboard"
            )
            self.assertEqual(after_14th_cb["state"], "stale")
            self.assertIn("2026-12-14", after_14th_cb["stale_reason"])

    def test_index_html_valid_and_synced_with_manifest(self) -> None:
        index_text = (REPO_ROOT / "index.html").read_text(encoding="utf-8")
        _StrictTagValidator().validate(index_text)

        report = cf.evaluate_portfolio(self.manifest)
        expected_section = cf.render_html_section(report)
        _StrictTagValidator().validate(expected_section)

        pattern = re.compile(
            re.escape(cf.START_MARKER) + r"\n(.*?)\n" + re.escape(cf.END_MARKER),
            re.DOTALL,
        )
        match = pattern.search(index_text)
        self.assertIsNotNone(match, "Missing FRESHNESS markers in index.html")
        self.assertEqual(match.group(1), expected_section)

    def test_html_and_markdown_escaping(self) -> None:
        synthetic = {
            "verified_at": "2026-11-22",
            "dashboards": [
                {
                    "id": "xss-check",
                    "name": 'A & B <script>"alert"</script>',
                    "href": "demo/",
                    "live_url": "https://example.invalid/demo/",
                    "source_repo": "SamuelJWebber/demo",
                    "publish_mode": "hub-mirror",
                    "hub_listed": True,
                    "cadence_label": "Manual & static",
                    "status_mode": "snapshot",
                    "max_age_days": None,
                    "sync_due_after": None,
                    "snapshot_date": "2026-11-22",
                    "latest_commit_date": "2026-11-22",
                    "latest_commit_sha": "abc1234",
                    "drift_note": "Pipe | and <tag> & quote",
                }
            ],
            "upcoming_deadlines": [
                {
                    "date": "2026-11-27",
                    "repo": "demo",
                    "title": "Check | Title",
                    "note": "Keep | escaped",
                }
            ],
        }
        report = cf.evaluate_portfolio(synthetic)
        html_out = cf.render_html_section(report)
        self.assertNotIn("<script>", html_out)
        self.assertIn("&lt;script&gt;", html_out)
        _StrictTagValidator().validate(html_out)

        md_out = cf.render_markdown(report)
        self.assertIn("Pipe \\| and <tag> & quote", md_out)
        self.assertIn("Check \\| Title", md_out)

    def test_cli_outputs_exit_codes_and_update_index_idempotency(self) -> None:
        with mock.patch("socket.socket", side_effect=AssertionError("No network calls")):
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = cf.main(["--format", "markdown", "--as-of", "2026-11-22"])
            self.assertEqual(code, 0)
            md = buf.getvalue()
            self.assertIn("## Portfolio Drift & Upcoming Deadlines", md)
            self.assertIn("### Upcoming Deadlines & Release Watch", md)
            self.assertIn("sale-shortlist", md)
            self.assertIn("citibike-dashboard", md)
            self.assertIn("ski-rentals-2027", md)

            buf_json = io.StringIO()
            with contextlib.redirect_stdout(buf_json):
                code_stale = cf.main(["--format", "json", "--as-of", "2026-12-15"])
            self.assertEqual(code_stale, 1)
            parsed = json.loads(buf_json.getvalue())
            self.assertFalse(parsed["healthy"])
            self.assertIn("citibike-dashboard", parsed["stale_ids"])

            buf_nofail = io.StringIO()
            with contextlib.redirect_stdout(buf_nofail):
                code_nofail = cf.main(
                    ["--format", "html", "--as-of", "2026-12-15", "--no-fail"]
                )
            self.assertEqual(code_nofail, 0)
            self.assertIn("badge-stale", buf_nofail.getvalue())

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_index = Path(tmpdir) / "index.html"
            tmp_index.write_text(
                f"<html><body>\n{cf.START_MARKER}\nstale\n{cf.END_MARKER}\n</body></html>\n",
                encoding="utf-8",
            )
            section = cf.render_html_section(cf.evaluate_portfolio(self.manifest))
            self.assertTrue(cf.update_index_html(tmp_index, section))
            self.assertFalse(cf.update_index_html(tmp_index, section))


if __name__ == "__main__":
    unittest.main()
