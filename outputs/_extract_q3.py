"""从 mx_finance_search 的分片 JSON 中提取三季报关键会计行（不把全文读进上下文）。"""
import json, re, sys
from html.parser import HTMLParser

class T(HTMLParser):
    def __init__(s):
        super().__init__(); s.o = []
    def handle_data(s, d):
        s.o.append(d.strip())
    def handle_endtag(s, t):
        if t in ('tr', 'p', 'div', 'table', 'br'):
            s.o.append('\n')

KEYS = [
    '营业收入', '营业总收入', '归属于上市公司股东的净利润', '归属于母公司股东的净利润',
    '扣除非经常性损益', '归属于上市公司股东的所有者权益', '总资产',
    '经营活动产生的现金流量净额', '基本每股收益', '稀释每股收益',
    '加权平均净资产收益率', '本报告期', '年初至报告期末',
]

def main():
    p = sys.argv[1]
    kw = sys.argv[2] if len(sys.argv) > 2 else ''
    d = json.load(open(p, encoding='utf-8'))
    groups = {}
    for it in d.get('data', []):
        base = re.sub(r'_\d+$', '', it.get('code', ''))
        groups.setdefault(base, {'t': it.get('title', ''), 'c': []})['c'].append(it.get('content', ''))
    out = []
    for base, g in groups.items():
        if kw and kw not in g['t']:
            continue
        parse = T(); parse.feed(''.join(g['c']))
        s = ' '.join(x for x in parse.o if x)
        s = re.sub(r'&nbsp;?', ' ', s)
        s = re.sub(r'[ \t]+', ' ', s)
        lines = [l.strip() for l in s.split('\n') if l.strip()]
        out.append((g['t'], lines))
    for title, lines in out[:3]:
        print('#### ' + title[:80])
        seen = set()
        for i, l in enumerate(lines):
            if not any(k in l for k in KEYS):
                continue
            if len(l) > 260:
                continue
            if l in seen:
                continue
            seen.add(l)
            ctx = ' | '.join(lines[max(0, i - 1):i + 2])[:230]
            print('  ' + ctx)
        print()

main()
