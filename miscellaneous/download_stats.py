import json
import os
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen


OWNER = "LeCheenaX"
REPO = "WordFlow-Tracker"
API_URL = f"https://api.github.com/repos/{OWNER}/{REPO}/releases?per_page=100&page={{page}}"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_PATH = SCRIPT_DIR / "download_data.json"
MANIFEST_PATH = REPO_ROOT / "manifest.json"


def load_download_data(data_path=DATA_PATH):
    with Path(data_path).open("r", encoding="utf-8") as f:
        rows = json.load(f)
    return [(row["date"], int(row["downloads"]), row["version"]) for row in rows]


def update_download_data(data_path=DATA_PATH, manifest_path=MANIFEST_PATH):
    rows = fetch_release_download_data()
    rows = ensure_manifest_version_row(rows, manifest_path)
    write_download_data(rows, data_path)
    return [(row["date"], row["downloads"], row["version"]) for row in rows]


def get_download_data(data_path=DATA_PATH, manifest_path=MANIFEST_PATH):
    try:
        return update_download_data(data_path, manifest_path)
    except Exception as exc:
        print(f"Could not update GitHub release download data: {exc}")
        print(f"Using cached data from {data_path}")
        return load_download_data(data_path)


def fetch_release_download_data():
    releases = []
    page = 1

    while True:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "wordflow-tracker-download-chart",
        }
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        request = Request(API_URL.format(page=page), headers=headers)
        with urlopen(request, timeout=30) as response:
            page_releases = json.loads(response.read().decode("utf-8"))

        if not page_releases:
            break

        releases.extend(page_releases)
        page += 1

    rows = []
    for release in releases:
        if release.get("draft"):
            continue

        release_date = release.get("published_at") or release.get("created_at")
        if not release_date:
            continue

        rows.append(
            {
                "date": release_date[:10],
                "downloads": sum(asset.get("download_count", 0) for asset in release.get("assets", [])),
                "version": release["tag_name"],
            }
        )

    return sorted(rows, key=lambda row: (row["date"], version_sort_key(row["version"])))


def ensure_manifest_version_row(rows, manifest_path):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    version = manifest["version"]

    if any(row["version"] == version for row in rows):
        return rows

    rows.append(
        {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "downloads": 0,
            "version": version,
        }
    )
    return sorted(rows, key=lambda row: (row["date"], version_sort_key(row["version"])))


def write_download_data(rows, data_path):
    Path(data_path).write_text(
        json.dumps(rows, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def version_sort_key(version):
    main, _, suffix = version.partition("-")
    parts = []

    for part in main.split("."):
        try:
            parts.append(int(part))
        except ValueError:
            parts.append(part)

    return (parts, suffix)
