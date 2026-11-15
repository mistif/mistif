"""Check a research answer's citations: does each URL open, and is the quoted text on the page?

Usage: python check_cites.py ledger.json
ledger.json: [{"claim": "...", "url": "https://...", "quote": "5 to 25 words copied from the page"}]
Prints one line per row: ok | quote missing | fetch failed (reason) | not checked (pdf), then a summary.
Exit code: the number of rows that are not ok (0 = all checked and found).
Standard library only. Pages are read as text; nothing is executed.
"""
import html
import json
import re
import sys
import urllib.request

UA = 'Mozilla/5.0 (compatible; mistif-research-check)'
MAX_BYTES = 5_000_000
CHARS = str.maketrans({'‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', ' ': ' '})


def normalize(text):
    """Lower-case, unify quote marks and dashes, collapse whitespace."""
    return re.sub(r'\s+', ' ', html.unescape(text).translate(CHARS).lower()).strip()


def page_text(raw):
    """Visible text of an HTML page (scripts, styles and tags removed)."""
    raw = re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>', ' ', raw)
    return normalize(re.sub(r'(?s)<[^>]+>', ' ', raw))


def words(s):
    return re.findall(r'[a-z0-9]+', s)


def find_quote(quote, text):
    """'ok' if the quote is on the page, ignoring case, punctuation and spacing; else 'quote missing'."""
    q = normalize(quote)
    if q and q in text:
        return 'ok'
    qw = words(q)
    return 'ok' if qw and ' '.join(qw) in ' '.join(words(text)) else 'quote missing'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,text/plain,*/*'})
    with urllib.request.urlopen(req, timeout=20) as r:
        kind = r.headers.get('Content-Type', '')
        body = r.read(MAX_BYTES)
    if 'pdf' in kind or body[:5] == b'%PDF-':
        return None
    return body.decode(r.headers.get_content_charset() or 'utf-8', errors='replace')


def check(row):
    url = str(row.get('url', ''))
    if not url.startswith(('http://', 'https://')):
        return 'fetch failed (not a web address)'
    try:
        raw = fetch(url)
    except Exception as e:  # any network or HTTP error means the link could not be re-checked
        return f'fetch failed ({type(e).__name__}: {str(e)[:80]})'
    if raw is None:
        return 'not checked (pdf)'
    return find_quote(str(row.get('quote', '')), page_text(raw))


def main(path):
    rows = json.load(open(path, encoding='utf-8'))
    bad = 0
    for i, row in enumerate(rows, 1):
        res = check(row)
        bad += res != 'ok'
        print(f'{i}. {res} | {row.get("url", "")}')
    print(f'{len(rows) - bad} of {len(rows)} ok')
    return bad


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(min(main(sys.argv[1]), 100))
