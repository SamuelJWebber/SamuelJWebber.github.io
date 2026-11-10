"""Reacquire bounded official samples and reproduce coverage / recorded-count audits.

Requires pandas and openpyxl. Run from any directory. This is not a causal estimator.
Downloads are cached by filename. Source metadata and hashes are written locally.
"""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import pandas as pd

ROOT = Path(__file__).resolve().parent
BERLIN = "https://mdhopendata.blob.core.windows.net/verkehrsdetektion/"
PARIS = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
SOURCES = {}

def fetch(name, url):
    path = ROOT / name
    if not path.exists():
        path.write_bytes(urlopen(url, timeout=90).read())
    SOURCES[name] = {"url": url, "bytes": path.stat().st_size,
                     "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return path

def main():
    fetch("berlin-readme.txt", BERLIN + "ReadMe.txt")
    meta = fetch("berlin-station-metadata.xlsx", BERLIN + "Stammdaten_Verkehrsdetektion_2022_07_20.xlsx")
    def month(ym):
        year, month = ym
        name = f"mq_hr_{year}_{month}.csv.gz"
        return fetch(name, BERLIN + f"{year}/alte_qualitaetssicherung/Messquerschnitte/{name}")
    with ThreadPoolExecutor(max_workers=4) as pool:
        files = list(pool.map(month, [(2019,"02"),(2019,"07"),(2020,"02"),(2020,"07")]))
    stations = pd.read_excel(meta)
    names = "Kant|Hallesche|Zossener|Gitschiner|Lichtenberger|Petersburger|Kottbusser|Schöneberger Ufer|Tempelhofer Ufer|Danziger|Frankfurter Allee|Adlergestell|Blaschko"
    selected = stations[stations.STRASSE.str.contains(names, case=False, na=False)]
    selected.to_csv(ROOT / "berlin-treatment-station-candidates.csv", index=False)
    audits, extracts = [], []
    for file in files:
        data = pd.read_csv(file, sep=";")
        data["source_file"] = file.name
        extracts.append(data[data.mq_name.isin(selected.MQ_KURZNAME)])
        for station, metadata in selected.groupby("MQ_KURZNAME"):
            rows = data[data.mq_name == station]
            audits.append({"mq_name": station, "road": metadata.STRASSE.iloc[0],
                "direction": metadata.RICHTUNG.iloc[0], "source_file": file.name,
                "valid_hours": len(rows), "observed_days": rows.tag.nunique(),
                "mean_hourly_vehicle_count": round(rows.q_kfz_mq_hr.mean(), 3),
                "mean_hourly_speed_kmh": round(rows.v_kfz_mq_hr.mean(), 3),
                "radspur_detectors": metadata.KOMMENTAR.fillna("").str.contains("Radspur").sum(),
                "metadata_detector_count": len(metadata)})
    pd.DataFrame(audits).to_csv(ROOT / "berlin-mq-coverage-audit.csv", index=False)
    pd.concat(extracts).to_csv(ROOT / "berlin-treatment-road-hourly-sample.csv.gz", index=False)
    ds = PARIS + "comptage-multimodal-comptages"
    fetch("paris-multimodal-metadata.json", ds)
    query = urlencode({"where": "id_site='10004' AND t >= date'2021-09-06T00:00:00Z' AND t < date'2021-09-13T00:00:00Z'"})
    sample = fetch("paris-rivoli-sample-week.json", ds + "/exports/json?" + query)
    counts = pd.DataFrame(json.loads(sample.read_text()))
    assert not counts.duplicated(["id_site", "id_trajectoire", "t", "mode"]).any()
    agg = counts.groupby(["id_trajectoire", "voie", "sens", "mode"]).agg(
        valid_hours=("t", "nunique"), vehicles=("nb_usagers", "sum")).reset_index()
    agg.to_csv(ROOT / "paris-rivoli-sample-aggregate.csv", index=False)
    query = urlencode({"select": "min(t) as first_hour,max(t) as last_hour,count(*) as rows", "where": "id_site='10004'", "limit": 1})
    fetch("paris-rivoli-history-coverage.json", ds + "/records?" + query)
    query = urlencode({"where": "id_site='10004'", "limit": 100})
    fetch("paris-rivoli-geometry.json", PARIS + "comptage-multimodal-sites-et-trajectoires-de-comptage/records?" + query)
    fetch("paris-multimodal-documentation.pdf", ds + "/attachments/documentation_v3_1_pdf")
    (ROOT / "source-download-manifest.json").write_text(json.dumps(SOURCES, indent=2))
    print("Berlin coverage audit regenerated. Paris recorded vehicles by mode:")
    print(counts.groupby("mode").nb_usagers.sum().to_string())
    print("These are availability / recorded-count audits, not all-person flow or causal estimates.")

if __name__ == "__main__":
    main()
