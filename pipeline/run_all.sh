#!/usr/bin/env bash
# Pipeline completo de dados do quant-terminal (local ou GitHub Actions).
# Uso: QT_DATA_OUT=public/data bash pipeline/run_all.sh
# Cada etapa é independente: uma falha (fonte fora do ar) não derruba as outras;
# o JSON anterior permanece no lugar e o status final lista o que falhou.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
# raiz do site: repo (pipeline/ ao lado de public/) ou work dir local (tools/pipeline → work/frontend)
if [ -d "$HERE/../public" ]; then ROOT="$HERE/.."; else ROOT="$HERE/../../work/frontend"; fi
export QT_DATA_OUT="${QT_DATA_OUT:-$ROOT/public/data}"
export QT_ALERTS="${QT_ALERTS:-$ROOT/alerts.yaml}"
export QT_CACHE="${QT_CACHE:-/tmp/qt_cache}"
export QT_ALERTS_MD="${QT_ALERTS_MD:-/tmp/alerts_fired.md}"
mkdir -p "$QT_DATA_OUT" "$QT_CACHE"
cd "$HERE"

FAILED=()
run() {
  local name="$1"; shift
  echo "::group::$name"
  local t0=$SECONDS
  if timeout -k 30 1200 python3 "$@"; then echo "[ok] $name ($((SECONDS - t0))s)"; else echo "[FALHOU] $name"; FAILED+=("$name"); fi
  echo "::endgroup::"
}

run prices   build_prices.py     # OHLCV 10a dos tickers do seletor + tickers.json (Yahoo)
run markets  build_markets.py    # universe (IBOV/B3), world, fx, econ (BCB/FRED), wfi, cdi
run rates    build_rates.py      # CDIE: DI1 (B3 BDI) + Copom (BCB) + Focus por reunião; curvas GC (FRED, Tesouro Transparente)
run corp     build_corp.py       # CVM DFP/ITR/FCA/IPE + Yahoo (proventos, splits, perfil)
run sec      build_sec.py        # ações dos EUA: SEC EDGAR companyfacts/submissions (DES/FUND/FA/VAL/RV) + Yahoo (preço bruto, proventos)
run calendar build_calendar.py   # CAL: datas de resultado do trimestre — sites de RI (todo dia) + CVM (IPE calendário, ITR/DFP) como reserva
run extra    build_extra.py      # GIP intradiário, GLCO futuros, ECFC Focus, ECST SIDRA, HDS (FRE), FA (DFP/ITR), screener EQS/RV/MOST
run macro    build_macro.py      # WB, FOMC, WIRP, TAYL, ECO, FXFC, FXC, GMM (Tesouro Transparente, BoE, FRED, Fed, BCB, IBGE, BLS/BEA/Census, Yahoo)
run credit   build_credit.py     # YAS (Tesouro Transparente + DI1), DRSK (CVM BPP + Yahoo), ECTR (Comex Stat) — depois de rates/extra
run options  build_options.py    # B3 COTAHIST diário (opções) + gregas Black-Scholes
run fns1     build_fns1.py      # BEIR (Tesouro Transparente), USMM (NY Fed), CBR (BIS), CRYP (CoinGecko, alternative.me, DefiLlama)
run fns2     build_fns2.py      # COT (CFTC Commitments of Traders), 13F (SEC EDGAR, carteiras de gestores)
run news     build_news.py       # RSS de licença aberta (Agência Brasil, BCB, CVM, SEC, Fed, RFB)
run anb      build_anb.py        # CVM Informe Diário de fundos → captação líquida por classe
run fns3     build_fns3.py      # FIIM (CVM informe mensal de FII + COTAHIST), FNDS (CVM informe diário), BKS (BCB IF.data)
run coverage build_coverage.py   # tickers.json: quais ativos têm DES/FUND/HDS/FA/OMON/GIP (arquivos por ticker gerados acima)
run alerts   build_alerts.py     # avalia alerts.yaml → alerts.json + $QT_ALERTS_MD se disparar (por último: usa os preços novos)

echo "Saída: $QT_DATA_OUT"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Etapas com falha: ${FAILED[*]}"
  # só falha o job se os preços (base de quase todas as telas) não atualizaram
  for f in "${FAILED[@]}"; do [ "$f" = "prices" ] && exit 1; done
fi
exit 0
