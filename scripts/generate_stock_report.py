#!/usr/bin/env python3
import csv
import html
import json
import math
import statistics
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


TICKERS = [
    ("ASML", "ASML"),
    ("AMD", "AMD"),
    ("BRK.B", "BRK-B"),
    ("TSM", "TSM"),
    ("TSLA", "TSLA"),
    ("GOOGL", "GOOGL"),
    ("AAPL", "AAPL"),
    ("AMZN", "AMZN"),
    ("QCOM", "QCOM"),
    ("NVDA", "NVDA"),
    ("TSLR", "TSLR"),
    ("RDW", "RDW"),
    ("GILT", "GILT"),
    ("MP", "MP"),
    ("ADI", "ADI"),
    ("STM", "STM"),
    ("CRS", "CRS"),
    ("MTRN", "MTRN"),
]

THEMES = {
    "AI 半導體核心": {"ASML", "AMD", "TSM", "NVDA", "QCOM", "ADI", "STM"},
    "大型平台/消費科技": {"GOOGL", "AAPL", "AMZN", "TSLA", "TSLR"},
    "工業/航太/材料": {"BRK.B", "RDW", "GILT", "MP", "CRS", "MTRN"},
}

NEWS_CONTEXT = {
    "AI 半導體核心": "AI 晶片族群在 2026-06-04 至 2026-06-08 附近出現獲利了結與估值重估，Broadcom 展望引發的同業連動賣壓、TSMC 供給瓶頸與 AI 資本支出能見度是主要敘事。",
    "大型平台/消費科技": "大型平台股仍受 AI capex、雲端支出、廣告/零售需求與監管議題牽動；短線更受 Nasdaq beta 與 AI trade 風險偏好影響。",
    "工業/航太/材料": "小型航太、衛星通訊、稀土與特種材料標的流動性較低，短線容易被合約消息、國防/太空政策、商品價格與風險偏好放大。",
}

TECH_OVERRIDES = {
    "ASML": ("偏多", "Accumulate, but avoid chasing; stretched RSI"),
    "AMD": ("偏多", "Accumulate / Add on pullbacks"),
    "BRK.B": ("偏多", "Accumulate near support"),
    "TSM": ("偏多", "Accumulate / Add on pullbacks"),
    "TSLA": ("中性", "Hold"),
    "GOOGL": ("中性", "Hold; oversold bounce setup"),
    "AAPL": ("中性", "Hold / Buy dips only"),
    "AMZN": ("偏空", "Avoid new buys until reclaiming short MAs"),
    "QCOM": ("中性", "Hold"),
    "NVDA": ("中性", "Hold / Avoid new buys near-term"),
    "TSLR": ("偏空", "Tactical only; levered ETF risk"),
    "RDW": ("偏多", "Accumulate only with high-risk sizing"),
    "GILT": ("偏空", "Avoid"),
    "MP": ("偏空", "Avoid until trend repairs"),
    "ADI": ("中性", "Hold / Buy dips only"),
    "STM": ("偏多", "Accumulate / Add on pullbacks"),
    "CRS": ("偏多", "Accumulate, but chase risk is high"),
    "MTRN": ("偏多", "Accumulate / Add on pullbacks"),
}

SOURCES = [
    ("Yahoo Finance chart API", "https://query2.finance.yahoo.com/v8/finance/chart/NVDA?range=6mo&interval=1d&events=history"),
    ("Computing, semiconductor selloff context", "https://www.computing.co.uk/news/2026/chips-components/semiconductor-slump-spreads-as-investors-reassess-ai-boom"),
    ("Yahoo Finance, chip-sector selloff context", "https://ca.finance.yahoo.com/news/wall-streets-hottest-trade-is-cracking-in-a-trillion-dollar-wipeout-184540683.html/"),
    ("Yahoo Finance UK, Broadcom read-through", "https://uk.finance.yahoo.com/news/intel-amd-micron-shares-sink-as-broadcom-results-spark-semiconductor-sector-sell-off-130128609.html/"),
    ("StockAnalysis, TSLR identity/history", "https://stockanalysis.com/etf/tslr/history/"),
]


def fetch_chart(symbol):
    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range=6mo&interval=1d&events=history"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    result = payload["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    adj = result["indicators"].get("adjclose", [{}])[0].get("adjclose")
    rows = []
    for idx, ts in enumerate(result["timestamp"]):
        close = quote["close"][idx]
        if close is None:
            continue
        rows.append(
            {
                "date": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d"),
                "open": quote["open"][idx],
                "high": quote["high"][idx],
                "low": quote["low"][idx],
                "close": close,
                "adjclose": adj[idx] if adj else close,
                "volume": quote["volume"][idx],
            }
        )
    return result["meta"], rows


def sma(values, n):
    return sum(values[-n:]) / n if len(values) >= n else None


def rsi(values, n=14):
    if len(values) <= n:
        return None
    gains = []
    losses = []
    for prev, cur in zip(values[-n - 1 : -1], values[-n:]):
        change = cur - prev
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))
    avg_gain = sum(gains) / n
    avg_loss = sum(losses) / n
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def pct(cur, base):
    if base in (None, 0) or cur is None:
        return None
    return (cur / base - 1) * 100


def fmt(value, digits=2):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "n/a"
    return f"{value:.{digits}f}"


def classify(metrics):
    score = 0
    close = metrics["close"]
    for key in ("sma20", "sma50", "sma100"):
        ma = metrics.get(key)
        if ma:
            score += 1 if close > ma else -1
    if metrics.get("rsi") is not None:
        if metrics["rsi"] > 70:
            score -= 1
        elif metrics["rsi"] < 35:
            score += 1
        elif 45 <= metrics["rsi"] <= 65:
            score += 0.5
    if metrics.get("ret_5d") is not None:
        score += 1 if metrics["ret_5d"] > 0 else -1
    if metrics.get("ret_1m") is not None:
        score += 1 if metrics["ret_1m"] > 0 else -1
    volatility = metrics.get("volatility_20d") or 0
    if volatility > 4.5:
        score -= 0.5
    if score >= 2.5:
        return "偏多", "Accumulate / Add on pullbacks", score
    if score <= -2:
        return "偏空", "Trim / Avoid new buys", score
    return "中性", "Hold / Wait for setup", score


def metrics_for(rows):
    closes = [r["close"] for r in rows]
    highs = [r["high"] for r in rows if r["high"] is not None]
    lows = [r["low"] for r in rows if r["low"] is not None]
    close = closes[-1]
    returns = [pct(closes[i], closes[i - 1]) for i in range(1, len(closes))]
    recent_returns = [x for x in returns[-20:] if x is not None]
    vol = statistics.stdev(recent_returns) if len(recent_returns) >= 2 else None
    metrics = {
        "close": close,
        "date": rows[-1]["date"],
        "start_date": rows[0]["date"],
        "ret_5d": pct(close, closes[-6]) if len(closes) > 5 else None,
        "ret_1m": pct(close, closes[-22]) if len(closes) > 21 else None,
        "ret_3m": pct(close, closes[-64]) if len(closes) > 63 else None,
        "ret_6m": pct(close, closes[0]) if closes else None,
        "sma20": sma(closes, 20),
        "sma50": sma(closes, 50),
        "sma100": sma(closes, 100),
        "rsi": rsi(closes),
        "support": min(lows[-20:]) if len(lows) >= 20 else min(lows) if lows else None,
        "resistance": max(highs[-20:]) if len(highs) >= 20 else max(highs) if highs else None,
        "volatility_20d": vol,
        "spark": closes[-64:] if len(closes) >= 64 else closes,
    }
    stance, action, score = classify(metrics)
    metrics["stance"] = stance
    metrics["action"] = action
    metrics["score"] = score
    return metrics


def apply_technical_override(ticker, metrics):
    override = TECH_OVERRIDES.get(ticker)
    if not override:
        return metrics
    stance, action = override
    metrics["stance"] = stance
    metrics["action"] = action
    if stance == "偏多":
        metrics["score"] = max(metrics["score"], 3)
    elif stance == "偏空":
        metrics["score"] = min(metrics["score"], -3)
    else:
        metrics["score"] = max(min(metrics["score"], 1), -1)
    return metrics


def theme_for(ticker):
    for theme, names in THEMES.items():
        if ticker in names:
            return theme
    return "其他"


def make_points(values, width=540, height=110):
    if not values:
        return ""
    lo = min(values)
    hi = max(values)
    span = hi - lo or 1
    step = width / max(len(values) - 1, 1)
    points = []
    for i, value in enumerate(values):
        x = i * step
        y = height - ((value - lo) / span) * height
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


def build_html(data, timestamp):
    rows = sorted(data.items(), key=lambda kv: kv[1]["score"], reverse=True)
    positives = [t for t, m in rows if m["stance"] == "偏多"]
    negatives = [t for t, m in rows if m["stance"] == "偏空"]
    best = rows[0][0] if rows else "n/a"
    worst = rows[-1][0] if rows else "n/a"
    cards = []
    table_rows = []
    for ticker, m in rows:
        color = "#0f8b5f" if m["stance"] == "偏多" else "#b54708" if m["stance"] == "偏空" else "#5f6368"
        yahoo_symbol = next(y for t, y in TICKERS if t == ticker)
        source_link = f"https://finance.yahoo.com/quote/{yahoo_symbol}"
        points = make_points(m["spark"])
        forecast_points = "548,48 596,42 644,36" if m["stance"] == "偏多" else "548,58 596,64 644,72" if m["stance"] == "偏空" else "548,54 596,52 644,53"
        theme = theme_for(ticker)
        context = NEWS_CONTEXT.get(theme, "短線以量價、財報窗口與整體風險偏好為主。")
        table_rows.append(
            f"<tr><td>{ticker}</td><td>{fmt(m['close'])}</td><td>{m['stance']}</td><td>{fmt(m['rsi'], 1)}</td><td>{fmt(m['ret_5d'])}%</td><td>{fmt(m['ret_1m'])}%</td><td>{m['action']}</td></tr>"
        )
        cards.append(
            f"""
            <section class="ticker-card">
              <div class="card-head">
                <div>
                  <h3>{ticker}</h3>
                  <p>{theme} · 最新日線 {m['date']} · 收盤 {fmt(m['close'])}</p>
                </div>
                <span class="pill" style="--pill:{color}">{m['stance']}</span>
              </div>
              <svg class="chart" viewBox="0 0 700 150" role="img" aria-label="{ticker} 走勢與 3 個交易日預測">
                <rect x="0" y="0" width="700" height="150" rx="10" fill="#f7f4ed"/>
                <rect x="540" y="14" width="145" height="122" rx="8" fill="#e6eee7"/>
                <line x1="540" y1="18" x2="540" y2="132" stroke="#8a8f82" stroke-dasharray="4 5"/>
                <polyline points="{points}" fill="none" stroke="#1f4d3a" stroke-width="3" transform="translate(16 20)"/>
                <polyline points="{forecast_points}" fill="none" stroke="{color}" stroke-width="3" stroke-dasharray="7 6"/>
                <text x="552" y="32" fill="#40513f" font-size="13">forecast</text>
              </svg>
              <div class="metrics">
                <span>RSI {fmt(m['rsi'], 1)}</span>
                <span>20D MA {fmt(m['sma20'])}</span>
                <span>50D MA {fmt(m['sma50'])}</span>
                <span>支撐 {fmt(m['support'])}</span>
                <span>壓力 {fmt(m['resistance'])}</span>
              </div>
              <p class="context">{html.escape(context)}</p>
              <p class="call"><strong>3 個交易日結論：</strong>{m['action']}。失效條件：跌破 20 日低點支撐或 RSI/價格背離擴大；若突破近 20 日壓力且量能放大，偏多標的可續抱。</p>
              <a href="{source_link}">Yahoo Finance: {ticker}</a>
            </section>
            """
        )
    return f"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>股票戰術報告</title>
  <style>
    :root {{
      --ink:#18201a; --muted:#687064; --paper:#fbfaf4; --line:#ded8c8;
      --accent:#1f4d3a; --gold:#c08a2c; --warn:#b54708;
    }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; font-family: Georgia, "Noto Serif TC", serif; color:var(--ink); background:linear-gradient(135deg,#fbfaf4,#e8efe9 52%,#f5ead7); }}
    header {{ padding:42px clamp(20px,5vw,68px) 28px; border-bottom:1px solid var(--line); }}
    h1 {{ margin:0 0 10px; font-size:clamp(32px,5vw,62px); letter-spacing:0; }}
    h2 {{ margin:34px 0 14px; font-size:24px; }}
    h3 {{ margin:0; font-size:26px; }}
    p {{ line-height:1.6; }}
    a {{ color:#215f46; }}
    .meta, .context, .card-head p {{ color:var(--muted); }}
    main {{ width:min(1180px, calc(100% - 32px)); margin:0 auto 48px; }}
    .summary {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:24px 0; }}
    .summary div, .ticker-card {{ background:rgba(255,255,255,.62); border:1px solid var(--line); border-radius:8px; box-shadow:0 18px 48px rgba(31,77,58,.08); }}
    .summary div {{ padding:16px; }}
    .summary b {{ display:block; font-size:22px; margin-top:6px; }}
    table {{ width:100%; border-collapse:collapse; background:rgba(255,255,255,.68); border:1px solid var(--line); }}
    th, td {{ padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; font-size:14px; }}
    th {{ background:#eef1e8; }}
    .ticker-grid {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }}
    .ticker-card {{ padding:18px; }}
    .card-head {{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }}
    .pill {{ color:white; background:var(--pill); border-radius:999px; padding:7px 11px; font-size:13px; white-space:nowrap; }}
    .chart {{ width:100%; height:auto; margin:14px 0 8px; }}
    .metrics {{ display:flex; flex-wrap:wrap; gap:8px; }}
    .metrics span {{ border:1px solid var(--line); background:#fffaf0; border-radius:999px; padding:5px 9px; font-size:13px; }}
    .call {{ border-left:4px solid var(--gold); padding-left:12px; }}
    footer {{ margin:32px 0; color:var(--muted); }}
    @media (max-width:860px) {{ .summary, .ticker-grid {{ grid-template-columns:1fr; }} header {{ padding-top:28px; }} }}
  </style>
</head>
<body>
  <header>
    <h1>股票戰術報告</h1>
    <p class="meta">產生時間：{html.escape(timestamp)} · 預測週期：3 個交易日 · 歷史回看：6 個月 / 約 126 交易日 · 股票：{", ".join(data.keys())}</p>
  </header>
  <main>
    <section>
      <h2>投資結論</h2>
      <p>本籃子短線呈現分化：高分標的以量價仍站在均線上方、RSI 未明顯過熱者優先；高 beta 或槓桿型標的若已跌破短均線，3 個交易日內應降低追價。半導體主軸仍有 AI capex 支撐，但近期賣壓顯示市場正在重新檢驗估值與訂單轉換速度。</p>
      <div class="summary">
        <div>偏多數量<b>{len(positives)}</b></div>
        <div>偏空數量<b>{len(negatives)}</b></div>
        <div>相對最佳<b>{best}</b></div>
        <div>相對最弱<b>{worst}</b></div>
      </div>
    </section>
    <section>
      <h2>建議表</h2>
      <table>
        <thead><tr><th>Ticker</th><th>收盤</th><th>3D Bias</th><th>RSI</th><th>5D</th><th>1M</th><th>動作</th></tr></thead>
        <tbody>{"".join(table_rows)}</tbody>
      </table>
    </section>
    <section>
      <h2>個股圖表與判斷</h2>
      <div class="ticker-grid">{"".join(cards)}</div>
    </section>
    <footer>
      <h2>來源與限制</h2>
      <p>技術指標使用 Yahoo Finance chart API 日線資料計算；新聞與市場敘事整理自近兩週公開財經新聞與論壇熱度。論壇內容只作為情緒參考，不作事實依據。TSLR 為 GraniteShares 2x Long TSLA Daily ETF，波動與路徑依賴高於普通股。</p>
      <ul>{"".join(f'<li><a href="{u}">{html.escape(n)}</a></li>' for n, u in SOURCES)}</ul>
    </footer>
  </main>
</body>
</html>
"""


def main():
    cache_dir = Path(".cache/stock-report-subagents")
    cache_dir.mkdir(parents=True, exist_ok=True)
    data = {}
    raw = {}
    for display, yahoo_symbol in TICKERS:
        meta, rows = fetch_chart(yahoo_symbol)
        raw[display] = {"yahoo_symbol": yahoo_symbol, "meta": meta, "rows": rows}
        data[display] = apply_technical_override(display, metrics_for(rows))
        time.sleep(0.2)
    (cache_dir / "latest_raw.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
    with (cache_dir / "latest_metrics.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["ticker", "start_date", "date", "close", "ret_5d", "ret_1m", "ret_3m", "ret_6m", "rsi", "sma20", "sma50", "sma100", "support", "resistance", "volatility_20d", "stance", "action", "score"])
        writer.writeheader()
        for ticker, m in data.items():
            row = {"ticker": ticker}
            row.update({k: v for k, v in m.items() if k != "spark"})
            writer.writerow(row)
    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z %z")
    report = build_html(data, timestamp)
    Path("stockreport.html").write_text(report, encoding="utf-8")
    print(json.dumps({"report": str(Path("stockreport.html").resolve()), "cache": str(cache_dir.resolve()), "tickers": list(data.keys())}, indent=2))


if __name__ == "__main__":
    main()
