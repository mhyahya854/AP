"""Byte-level scanner for the 1.13 GB reader artifact (step 3 tooling).

Read-only.  Never loads the whole file; streams 8 MiB blocks with a byte
overlap so markers that straddle a block boundary are still found.

usage:
  python reader/step3_scan.py <file> show  <start> <len>
  python reader/step3_scan.py <file> dump  <start> <len> <outFile>
  python reader/step3_scan.py <file> find  <needle> [maxHits] [ctx]
  python reader/step3_scan.py <file> multi <needle1> <needle2> ...
"""
import sys


def stream_hits(path, needles, ctx=0, cap=40):
    hits = {n: [] for n in needles}
    counts = {n: 0 for n in needles}
    overlap = 64
    base = 0
    with open(path, 'rb') as fh:
        tail = b''
        while True:
            block = fh.read(8 << 20)
            if not block:
                break
            buf = tail + block
            limit = max(0, len(buf) - overlap)
            body = buf[:limit]
            for n in needles:
                i = body.find(n)
                while i >= 0:
                    counts[n] += 1
                    if len(hits[n]) < cap:
                        if ctx:
                            s = max(0, i - ctx)
                            hits[n].append((base + i, body[s:i + len(n) + ctx].decode('utf-8', 'replace')))
                        else:
                            hits[n].append((base + i, None))
                    i = body.find(n, i + 1)
            base += limit
            tail = buf[limit:]
        for n in needles:
            i = tail.find(n)
            while i >= 0:
                counts[n] += 1
                if len(hits[n]) < cap:
                    hits[n].append((base + i, None))
                i = tail.find(n, i + 1)
    return hits, counts


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    path = sys.argv[1]
    cmd = sys.argv[2]
    if cmd == 'show':
        start, ln = int(sys.argv[3]), int(sys.argv[4])
        with open(path, 'rb') as fh:
            fh.seek(start)
            sys.stdout.write(fh.read(ln).decode('utf-8', 'replace'))
        return
    if cmd == 'dump':
        start, ln, out = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        with open(path, 'rb') as fh:
            fh.seek(start)
            data = fh.read(ln).decode('utf-8', 'replace')
        with open(out, 'w', encoding='utf-8') as fh:
            fh.write(data)
        print('wrote', out, len(data), 'chars')
        return
    if cmd == 'find':
        n = sys.argv[3].encode()
        cap = int(sys.argv[4]) if len(sys.argv) > 4 else 40
        ctx = int(sys.argv[5]) if len(sys.argv) > 5 else 0
        hits, counts = stream_hits(path, [n], ctx, cap)
        print(n.decode(), 'count=', counts[n])
        for off, snip in hits[n]:
            print(off, repr(snip) if snip else '')
        return
    if cmd == 'multi':
        needles = [a.encode() for a in sys.argv[3:]]
        hits, counts = stream_hits(path, needles, 0, 6)
        for n in needles:
            print(n.decode(), 'count=', counts[n], 'first=', hits[n][:6])
        return
    print(__doc__)


if __name__ == '__main__':
    main()
