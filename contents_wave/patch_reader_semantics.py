"""PATCH-1/PATCH-2: honest pagination vocabulary, a Section mode, and non-overlapping mobile drawers.

Two verified edits inside the reader shell, plus one additive script:
  * the `<select id="mode">` option list (Section replaces the printed-spread claim);
  * a new `<script>` with reader/ui2.js inserted after the last existing script.
Every other byte - including all 1,899 source regions - is copied unchanged.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OLD_SELECT = ('<select id="mode"><option value="continuous">Continuous</option>'
              '<option value="single">Single page</option>'
              '<option value="spread">Two-page spread</option></select>')
NEW_SELECT = ('<select id="mode"><option value="continuous">Continuous</option>'
              '<option value="section">Section</option>'
              '<option value="single">Source capture</option></select>')
ANCHOR = b"</body>"
TAIL = 400_000        # the reader shell lives after the 1,899 regions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--ui2", required=True)
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out, ui2 = Path(a.source), Path(a.output), Path(a.ui2)

    size = src.stat().st_size
    tail_start = size - TAIL
    with src.open("rb") as fh:
        fh.seek(tail_start)
        tail = fh.read()
    text = tail.decode("utf-8")
    if text.count(OLD_SELECT) != 1:
        raise SystemExit("mode select not found exactly once (%d)" % text.count(OLD_SELECT))
    script = ('<script>\n' + ui2.read_text(encoding="utf-8").rstrip() + '\n</script>\n')
    new_tail = tail.replace(OLD_SELECT.encode("utf-8"), NEW_SELECT.encode("utf-8"), 1)
    if new_tail.count(ANCHOR) != 1:
        raise SystemExit("</body> not found exactly once in the shell")
    new_tail = new_tail.replace(ANCHOR, script.encode("utf-8") + ANCHOR, 1)

    h = hashlib.sha256()
    written = 0
    with src.open("rb") as fh, out.open("wb") as oh:
        left = tail_start
        while left > 0:
            c = fh.read(min(16 << 20, left))
            if not c:
                break
            oh.write(c)
            h.update(c)
            written += len(c)
            left -= len(c)
        oh.write(new_tail)
        h.update(new_tail)
        written += len(new_tail)

    report = {
        "patch": "PATCH-1/PATCH-2 reader semantics + mobile drawers",
        "source": str(src), "output": str(out),
        "source_bytes": src.stat().st_size, "output_bytes": written,
        "bytes_added": written - src.stat().st_size,
        "output_sha256": h.hexdigest(),
        "mode_select_replaced": True,
        "ui2_script_bytes": len(script),
        "ui2_sha256": hashlib.sha256(ui2.read_bytes()).hexdigest(),
    }
    if a.report:
        Path(a.report).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
