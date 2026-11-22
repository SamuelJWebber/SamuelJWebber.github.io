"""Verify zero credential, path, email, or held-back parquet leaks across public artifacts."""

from __future__ import annotations

from pathlib import Path
import re
import sys
import unittest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import check_freshness as cf  # noqa: E402

OWNED_PATHS = (
    REPO_ROOT / "index.html",
    REPO_ROOT / "README.md",
    REPO_ROOT / ".gitattributes",
    REPO_ROOT / ".gitignore",
    REPO_ROOT / "data" / "portfolio_status.json",
    REPO_ROOT / "tools" / "check_freshness.py",
    REPO_ROOT / "tests" / "test_freshness.py",
    REPO_ROOT / "tests" / "test_no_leaks.py",
)

LEAK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("email address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("Windows user path", re.compile(r"[A-Za-z]:[/\\]Users[/\\][A-Za-z0-9._-]+")),
    ("Unix home path", re.compile(r"(?:^|[\s'\"(=])/(?:Users|home)/[A-Za-z0-9._-]+")),
    ("file URI", re.compile("file:" + "//")),
    ("GitHub token", re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("API key token", re.compile(r"(?:\bsk-[A-Za-z0-9]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b)")),
)


class TestNoLeaks(unittest.TestCase):
    """Ensure public files and generated outputs are leak-free and offline."""

    def _assert_clean_text(self, label: str, text: str) -> None:
        for kind, pattern in LEAK_PATTERNS:
            match = pattern.search(text)
            self.assertIsNone(
                match,
                f"Potential {kind} leak in {label}: {match.group(0) if match else ''}",
            )

    def test_owned_files_contain_no_secrets_paths_or_emails(self) -> None:
        for path in OWNED_PATHS:
            self.assertTrue(path.exists(), f"Expected file missing: {path}")
            raw = path.read_bytes()
            self.assertNotIn(b"\r\n", raw, f"CRLF line endings found in {path.name}")
            self._assert_clean_text(str(path.relative_to(REPO_ROOT)), raw.decode("utf-8"))

    def test_generated_outputs_contain_no_leaks(self) -> None:
        manifest = cf.load_manifest()
        report = cf.evaluate_portfolio(manifest)
        self._assert_clean_text("generated markdown", cf.render_markdown(report))
        self._assert_clean_text("generated html", cf.render_html_section(report))

    def test_no_held_back_kalshi_or_extra_parquet_files(self) -> None:
        forbidden = list(REPO_ROOT.rglob("forward-kalshi-*.parquet"))
        self.assertEqual(forbidden, [], f"Held-back Kalshi parquet present: {forbidden}")

        for folder in (REPO_ROOT / "data", REPO_ROOT / "tools", REPO_ROOT / "tests"):
            parquets = list(folder.rglob("*.parquet")) if folder.exists() else []
            self.assertEqual(parquets, [], f"Unexpected parquet files in {folder.name}: {parquets}")

    def test_tools_and_tests_make_no_network_imports(self) -> None:
        forbidden_imports = re.compile(
            r"^\s*(?:import|from)\s+(?:urllib|http\.client|requests|httpx|aiohttp)\b",
            re.MULTILINE,
        )
        for path in (
            REPO_ROOT / "tools" / "check_freshness.py",
            REPO_ROOT / "tests" / "test_freshness.py",
            REPO_ROOT / "tests" / "test_no_leaks.py",
        ):
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(
                forbidden_imports.search(text),
                f"Forbidden network client import in {path.name}",
            )


if __name__ == "__main__":
    unittest.main()
