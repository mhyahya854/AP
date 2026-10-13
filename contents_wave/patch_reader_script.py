"""Replace the additive ui2.js script block inside the finished book."""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
OPEN, CLOSE, MARK = b"<script>", b"</script>", b"window.book2Semantics"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--ui2", required=True)
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out, ui2 = Path(a.source), Path(a.output), Path(a.ui2)
    data = src.read_bytes()
    i = data.find(MARK)
    if i < 0:
        raise SystemExit("ui2 script not found")
    s = data.rfind(OPEN, 0, i)
    e = data.find(CLOSE, i)
    if s < 0 or e < 0:
        raise SystemExit("ui2 script block not delimited")
    old = data[s:e + len(CLOSE)]
    new_block = (OPEN + b"\n" + ui2.read_bytes().rstrip() + b"\n" + CLOSE)
    new_data = data[:s] + new_block + data[e + len(CLOSE):]
    h = hashlib.sha256()
    h.update(new_data)
    out.write_bytes(new_data)
    report = {"patch": "update additive reader script (ui2)",
              "source": str(src), "output": str(out),
              "old_block_bytes": len(old), "new_block_bytes": len(new_block),
              "bytes_delta": len(new_data) - len(data),
              "ui2_sha256": hashlib.sha256(ui2.read_bytes()).hexdigest(),
              "output_bytes": len(new_data), "output_sha256": h.hexdigest()}
    if a.report:
        Path(a.report).write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
