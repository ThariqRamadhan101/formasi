"""Extract `Formasi.xlsx` (and optionally `DATA PEGAWAI.xlsx`) into JSON.

The Formasi workbook has a single sheet `FORMASI` with the input columns:
  Eselon, Unit Kerja, Satuan Kerja, Seksi Kerja, Jabatan, Jenjang,
  Jenis Jabatan, Fomasi?, Kebutuhan.

The employee workbook (`DATA PEGAWAI`) is merged in:
  * employees are matched to formasi rows by (Unit Kerja, Jabatan, Jenjang);
    when several formasi rows share the same key (different Satuan/Seksi) the
    employees are spread evenly ("bagi rata") across them;
  * employees with no matching row become NEW formasi rows flagged
    `formasi = "TIDAK"` (kebutuhan 0, bezetting = jumlah pegawai);
  * every row gets `bezetting`, `formasiGap` (Kebutuhan - Bezetting) and the
    list of `pegawai` attached to it.

Outputs (written to public/data):
  - formasi.json : merged rows + summary
  - options.json : seed option lists derived from the data

The formasi source is picked automatically from the `database/` folder, in
priority order:
  1. CSV  `database/FORMASI.csv`     (app "Download CSV" format, `;`-separated)
  2. JSON master `database/formasi-master.json`
  3. Excel `database/Formasi.xlsx`
Use `--no-csv` / `--no-master` to skip a source. Employee data still comes from
`database/DATA PEGAWAI.xlsx`. Fungsional status (a separate registry that is not
derived from the data) is read from `database/status-fungsional.json` and copied
to `public/data/fungsional-status.json`. The app's in-app editor can export JSON
("Export database") or CSV (Data Formasi tab), and status JSON from the
Status Fungsional tab.

Usage:
    python scripts/extract_formasi.py                    # auto: CSV > JSON > Excel
    python scripts/extract_formasi.py --write-csv        # (re)write database/FORMASI.csv
    python scripts/extract_formasi.py --write-master     # seed the JSON master
    python scripts/extract_formasi.py --no-csv --no-master   # force reading Formasi.xlsx
    python scripts/extract_formasi.py --xlsx database/Formasi.xlsx --pegawai "database/DATA PEGAWAI.xlsx"
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import openpyxl

SHEET = "FORMASI"
PEGAWAI_SHEET = "DATA PEGAWAI"

# 0-based columns of sheet "FORMASI" (header is row 1).
COLUMNS = {
    0: "eselon",
    1: "unitKerja",
    2: "satuanKerja",
    3: "seksiKerja",
    4: "jabatan",
    5: "jenjang",
    6: "jenisJabatan",
    7: "formasi",
    8: "kebutuhan",
}

INT_COLUMNS = {"kebutuhan"}

# The 9 manual input columns stored in the JSON formasi master.
INPUT_FIELDS = [
    "eselon",
    "unitKerja",
    "satuanKerja",
    "seksiKerja",
    "jabatan",
    "jenjang",
    "jenisJabatan",
    "formasi",
    "kebutuhan",
]

# Header (lower-cased, trimmed) -> internal field, for CSV imports.
# Matches the app's "Download CSV" export (semicolon-separated, extra derived
# Bezetting/Formasi columns are ignored). "Fomasi?" tolerates the workbook typo.
CSV_HEADER_MAP = {
    "eselon": "eselon",
    "unit kerja": "unitKerja",
    "satuan kerja": "satuanKerja",
    "seksi kerja": "seksiKerja",
    "jabatan": "jabatan",
    "jenjang": "jenjang",
    "jenis jabatan": "jenisJabatan",
    "formasi?": "formasi",
    "fomasi?": "formasi",
    "kebutuhan": "kebutuhan",
}

OPTION_COLUMNS = {
    "unitKerja": "unitKerja",
    "satuanKerja": "satuanKerja",
    "seksiKerja": "seksiKerja",
    "jabatan": "jabatan",
    "jenjang": "jenjang",
    "jenisJabatan": "jenisJabatan",
    "formasi": "formasi",
}

# Longest first so "Ahli Pertama" is stripped before any shorter overlap.
JENJANG_SUFFIXES = [
    "Ahli Utama",
    "Ahli Madya",
    "Ahli Muda",
    "Ahli Pertama",
    "Penyelia",
    "Mahir",
    "Terampil",
    "Pemula",
]

JENJANG_MAP = {
    "AHLI UTAMA": "Ahli Utama",
    "AHLI MADYA": "Ahli Madya",
    "AHLI MUDA": "Ahli Muda",
    "AHLI PERTAMA": "Ahli Pertama",
    "PENYELIA": "Penyelia",
    "MAHIR": "Mahir",
    "TERAMPIL": "Terampil",
    "PEMULA": "Pemula",
    "PELAKSANA": "-",
    "PELAKSANA TERAMPIL": "Terampil",
    "PELAKSANA LANJUTAN (MAHIR)": "Mahir",
    "KARYASISWA": "-",
    "DOSEN (LEKTOR)": "-",
    "ADMINISTRATOR": "-",
    "PENGAWAS": "-",
    "JPT PRATAMA": "-",
}

JENIS_MAP = {
    "JABATAN STRUKTURAL": "Jabatan Struktural",
    "JABATAN FUNGSIONAL": "Jabatan Fungsional",
    "JABATAN PELAKSANA": "Jabatan Pelaksana",
    "JABATAN LAINNYA": "Jabatan Lainnya",
}


def clean(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def to_int(value) -> int:
    text = clean(value)
    if text == "":
        return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def norm_key(value: str) -> str:
    return " ".join(value.strip().lower().split())


def base_jabatan(nama: str) -> str:
    low = nama.strip().lower()
    for suffix in JENJANG_SUFFIXES:
        if low.endswith(suffix.lower()):
            return nama.strip()[: len(nama.strip()) - len(suffix)].strip()
    return nama.strip()


def norm_jenjang(value: str) -> str:
    text = value.strip()
    mapped = JENJANG_MAP.get(text.upper())
    if mapped is not None:
        return mapped
    return text.title()


def norm_jenis(value: str) -> str:
    return JENIS_MAP.get(value.strip().upper(), value.strip().title())


def extract_rows(path: Path) -> list[dict]:
    df = pd.read_excel(path, sheet_name=SHEET, header=None, engine="openpyxl")
    rows: list[dict] = []
    for idx in range(1, len(df)):  # skip header
        record: dict = {"id": idx + 1}
        empty = True
        for col, key in COLUMNS.items():
            raw = df.iat[idx, col] if col < df.shape[1] else None
            value = to_int(raw) if key in INT_COLUMNS else clean(raw)
            record[key] = value
            if value not in ("", 0):
                empty = False
        if empty:
            continue
        rows.append(record)
    return rows


def load_formasi_json(path: Path) -> list[dict]:
    """Read formasi rows from a JSON master (replaces the Formasi.xlsx source)."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_rows = payload.get("rows", []) if isinstance(payload, dict) else payload
    rows: list[dict] = []
    for index, raw in enumerate(raw_rows):
        record: dict = {"id": int(raw.get("id", index + 1))}
        empty = True
        for key in INPUT_FIELDS:
            value = to_int(raw.get(key, 0)) if key in INT_COLUMNS else clean(raw.get(key, ""))
            record[key] = value
            if value not in ("", 0):
                empty = False
        if empty:
            continue
        rows.append(record)
    return rows


def write_master_json(path: Path, rows: list[dict]) -> None:
    """Persist the manual input columns as the editable JSON master."""
    master = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": path.name,
        "rows": [{key: row.get(key, "") for key in ("id", *INPUT_FIELDS)} for row in rows],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(master, ensure_ascii=False, indent=1), encoding="utf-8")


def read_formasi_csv(path: Path) -> list[dict]:
    """Read formasi rows from the app's CSV export (semicolon-separated)."""
    df = pd.read_csv(
        path,
        sep=";",
        dtype=str,
        keep_default_na=False,
        encoding="utf-8-sig",
        engine="python",
    )
    if df.shape[1] < 2:  # fall back to comma-separated
        df = pd.read_csv(
            path,
            sep=",",
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
            engine="python",
        )

    colmap = {
        col: CSV_HEADER_MAP[col.strip().lower()]
        for col in df.columns
        if col.strip().lower() in CSV_HEADER_MAP
    }
    if not colmap:
        raise ValueError(
            f"Tidak ada kolom yang dikenali di {path.name}. "
            "Header harus memuat minimal 'Jabatan' dan 'Unit Kerja'."
        )

    rows: list[dict] = []
    for index, raw in enumerate(df.to_dict("records")):
        record: dict = {"id": index + 1}
        empty = True
        for col, field in colmap.items():
            value = to_int(raw.get(col, "")) if field in INT_COLUMNS else clean(raw.get(col, ""))
            record[field] = value
            if value not in ("", 0):
                empty = False
        for field in INPUT_FIELDS:
            record.setdefault(field, 0 if field in INT_COLUMNS else "")
        if empty:
            continue
        rows.append(record)

    # Re-number ids densely after dropping blank lines.
    for index, record in enumerate(rows, start=1):
        record["id"] = index
    return rows


def write_formasi_csv(path: Path, rows: list[dict]) -> None:
    """Persist the manual input columns as a semicolon-separated CSV."""
    import csv

    headers = [
        "Eselon",
        "Unit Kerja",
        "Satuan Kerja",
        "Seksi Kerja",
        "Jabatan",
        "Jenjang",
        "Jenis Jabatan",
        "Formasi?",
        "Kebutuhan",
    ]
    fields = ["eselon", "unitKerja", "satuanKerja", "seksiKerja", "jabatan", "jenjang", "jenisJabatan", "formasi", "kebutuhan"]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, delimiter=";")
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(field, "") for field in fields])


def load_status_json(path: Path) -> dict:
    """Read the fungsional status registry (`{ jabatan: statusId }`)."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw = payload.get("status", payload) if isinstance(payload, dict) else {}
    if not isinstance(raw, dict):
        return {}
    return {str(key): str(value) for key, value in raw.items() if isinstance(value, str)}


def extract_employees(path: Path) -> list[dict]:
    if not path.exists():
        return []
    wb = openpyxl.load_workbook(path, read_only=True)
    sheet_name = PEGAWAI_SHEET if PEGAWAI_SHEET in wb.sheetnames else wb.sheetnames[0]
    wb.close()
    df = pd.read_excel(path, sheet_name=sheet_name, header=0, engine="openpyxl")
    employees: list[dict] = []
    for _, row in df.iterrows():
        nama = clean(row.get("NAMA LENGKAP"))
        unit = clean(row.get("UNIT KERJA"))
        if not nama or not unit:
            continue
        nama_jabatan = clean(row.get("NAMA JABATAN"))
        employees.append(
            {
                "nama": nama,
                "nip": clean(row.get("NIP")),
                "status": clean(row.get("STATUS PEGAWAI")),
                "unitKerja": unit,
                "jabatan": base_jabatan(nama_jabatan),
                "jenjang": norm_jenjang(clean(row.get("JENJANG JABATAN"))),
                "jenisJabatan": norm_jenis(clean(row.get("JENIS JABATAN"))),
            }
        )
    return employees


def merge_employees(rows: list[dict], employees: list[dict]) -> dict:
    for row in rows:
        row["bezetting"] = 0
        row["pegawai"] = []

    # Index formasi rows by (unit, jabatan, jenjang) for even distribution.
    index: dict[tuple[str, str, str], list[dict]] = {}
    for row in rows:
        key = (norm_key(row["unitKerja"]), norm_key(row["jabatan"]), norm_key(row["jenjang"]))
        index.setdefault(key, []).append(row)

    cursor: dict[tuple[str, str, str], int] = {}
    unmatched: dict[tuple[str, str, str, str], dict] = {}
    matched = 0

    for emp in employees:
        key = (norm_key(emp["unitKerja"]), norm_key(emp["jabatan"]), norm_key(emp["jenjang"]))
        targets = index.get(key)
        if targets:
            position = cursor.get(key, 0)
            target = targets[position % len(targets)]
            cursor[key] = position + 1
            target["pegawai"].append({"nama": emp["nama"], "nip": emp["nip"], "status": emp["status"]})
            matched += 1
        else:
            group_key = (emp["unitKerja"], emp["jabatan"], emp["jenjang"], emp["jenisJabatan"])
            bucket = unmatched.get(group_key)
            if bucket is None:
                bucket = {
                    "eselon": "",
                    "unitKerja": emp["unitKerja"],
                    "satuanKerja": "-",
                    "seksiKerja": "-",
                    "jabatan": emp["jabatan"],
                    "jenjang": emp["jenjang"],
                    "jenisJabatan": emp["jenisJabatan"],
                    "formasi": "TIDAK",
                    "kebutuhan": 0,
                    "bezetting": 0,
                    "pegawai": [],
                }
                unmatched[group_key] = bucket
            bucket["pegawai"].append({"nama": emp["nama"], "nip": emp["nip"], "status": emp["status"]})

    next_id = max((row["id"] for row in rows), default=0) + 1
    for bucket in unmatched.values():
        bucket["id"] = next_id
        next_id += 1
        rows.append(bucket)

    for row in rows:
        row["bezetting"] = len(row["pegawai"])
        row["formasiGap"] = int(row.get("kebutuhan", 0) or 0) - row["bezetting"]

    return {"matched": matched, "unmatched": len(employees) - matched, "newRows": len(unmatched)}


def extract_options(rows: list[dict]) -> dict:
    options: dict[str, list[str]] = {key: [] for key in OPTION_COLUMNS}
    for row in rows:
        for option_key, row_key in OPTION_COLUMNS.items():
            value = row.get(row_key, "")
            if value and value not in options[option_key]:
                options[option_key].append(value)
    return options


def summarize(rows: list[dict]) -> dict:
    return {
        "rows": len(rows),
        "kebutuhan": sum(int(row.get("kebutuhan", 0) or 0) for row in rows),
        "bezetting": sum(int(row.get("bezetting", 0) or 0) for row in rows),
        "pegawaiTanpaFormasi": sum(int(row.get("bezetting", 0) or 0) for row in rows if row.get("formasi") == "TIDAK"),
        "unitKerja": len({row["unitKerja"] for row in rows if row["unitKerja"]}),
        "satuanKerja": len({row["satuanKerja"] for row in rows if row["satuanKerja"]}),
        "jabatan": len({row["jabatan"] for row in rows if row["jabatan"]}),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", default="database/Formasi.xlsx", help="Path to Formasi.xlsx")
    parser.add_argument(
        "--formasi-csv",
        default="database/FORMASI.csv",
        help="Formasi CSV (app export format). Used first when it exists.",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Ignore --formasi-csv and fall back to the JSON master / Excel.",
    )
    parser.add_argument(
        "--formasi-json",
        default="database/formasi-master.json",
        help="JSON master for formasi rows, used when no CSV is present.",
    )
    parser.add_argument(
        "--no-master",
        action="store_true",
        help="Ignore the JSON master and read formasi from --xlsx instead.",
    )
    parser.add_argument(
        "--write-master",
        action="store_true",
        help="Also write the manual input columns to --formasi-json.",
    )
    parser.add_argument(
        "--write-csv",
        action="store_true",
        help="Also write the manual input columns to --formasi-csv.",
    )
    parser.add_argument("--pegawai", default="database/DATA PEGAWAI.xlsx", help="Path to DATA PEGAWAI.xlsx")
    parser.add_argument(
        "--status-json",
        default="database/status-fungsional.json",
        help="Fungsional status source; copied into the served data folder.",
    )
    parser.add_argument("--out", default="public/data", help="Output directory")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    xlsx = (root / args.xlsx).resolve()
    formasi_csv = (root / args.formasi_csv).resolve()
    master_json = (root / args.formasi_json).resolve()
    status_json = (root / args.status_json).resolve()
    pegawai_xlsx = (root / args.pegawai).resolve()
    out_dir = (root / args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    use_csv = formasi_csv.exists() and not args.no_csv
    use_master = (not use_csv) and master_json.exists() and not args.no_master
    if use_csv:
        rows = read_formasi_csv(formasi_csv)
        formasi_source = f"{formasi_csv.name} + {pegawai_xlsx.name}"
        print(f"formasi source: CSV {formasi_csv}")
    elif use_master:
        rows = load_formasi_json(master_json)
        formasi_source = f"{master_json.name} + {pegawai_xlsx.name}"
        print(f"formasi source: JSON master {master_json}")
    else:
        rows = extract_rows(xlsx)
        formasi_source = f"{xlsx.name}#{SHEET} + {pegawai_xlsx.name}"
        print(f"formasi source: Excel {xlsx}")

    if args.write_master:
        write_master_json(master_json, rows)
        print(f"wrote         : {master_json}")
    if args.write_csv:
        write_formasi_csv(formasi_csv, rows)
        print(f"wrote         : {formasi_csv}")

    employees = extract_employees(pegawai_xlsx)
    stats = merge_employees(rows, employees)
    options = extract_options(rows)
    stamp = datetime.now(timezone.utc).isoformat()

    formasi_payload = {
        "generatedAt": stamp,
        "source": formasi_source,
        "summary": summarize(rows),
        "rows": rows,
    }

    (out_dir / "formasi.json").write_text(
        json.dumps(formasi_payload, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (out_dir / "options.json").write_text(
        json.dumps({"generatedAt": stamp, **options}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    served_status = out_dir / "fungsional-status.json"
    if status_json.exists():
        status_payload = load_status_json(status_json)
        served_status.write_text(
            json.dumps({"generatedAt": stamp, "status": status_payload}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        print(f"status source : {status_json} ({len(status_payload)} jabatan)")
    elif not served_status.exists():
        served_status.write_text(
            json.dumps({"generatedAt": stamp, "status": {}}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        print("status source : (kosong, dibuat default)")

    print(f"rows          : {len(rows)}")
    print(f"kebutuhan     : {formasi_payload['summary']['kebutuhan']}")
    print(f"bezetting     : {formasi_payload['summary']['bezetting']}")
    print(f"pegawai       : {len(employees)} (matched {stats['matched']}, unmatched {stats['unmatched']})")
    print(f"new rows      : {stats['newRows']}")
    print(f"unit kerja    : {len(options['unitKerja'])}")
    print(f"jabatan       : {len(options['jabatan'])}")
    print(f"wrote         : {out_dir / 'formasi.json'}")
    print(f"wrote         : {out_dir / 'options.json'}")


if __name__ == "__main__":
    main()
