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

# Etapas em trilhas paralelas (as dependências entre JSONs ficam na ordem de cada trilha). Cada etapa grava
# o próprio log em $LOGS e, ao terminar, o log sai inteiro num ::group:: (sem linhas de trilhas misturadas).
# Fontes com limite de requisições (Yahoo) ficam numa trilha só; gravações de cache/JSON são atômicas (common.write_atomic).
LOGS="$(mktemp -d)"; T_ALL=$SECONDS
run() {
  local name="$1"; shift
  local t0=$SECONDS rc=0
  timeout -k 30 "${STEP_TIMEOUT:-1200}" python3 "$@" > "$LOGS/$name.log" 2>&1 || rc=$?
  {
    flock 9
    echo "::group::$name"; cat "$LOGS/$name.log"
    if [ $rc -eq 0 ]; then echo "[ok] $name ($((SECONDS - t0))s)"; else echo "[FALHOU] $name ($((SECONDS - t0))s, código $rc)"; echo "$name" >> "$LOGS/FAILED"; fi
    echo "::endgroup::"
  } 9> "$LOGS/.lock"
}

# ---- fase 1 -------------------------------------------------------------------------------------------
# trilha Yahoo: prices → markets → corp (corp precisa de tickers.json e official_close.json)
#   calendar e options só precisam de universe.json/cdi.json (markets) e rodam ao lado do corp
(
  run prices   build_prices.py     # OHLCV 10a dos tickers do seletor + tickers.json (Yahoo) + fechamento oficial B3
  run markets  build_markets.py    # universe (IBOV/B3), world, fx, econ (BCB/FRED), wfi, cdi
  (
    run calendar build_calendar.py # CAL: datas de resultado do trimestre — sites de RI (todo dia) + CVM como reserva
    run options  build_options.py  # B3 COTAHIST diário (opções) + gregas Black-Scholes
  ) &
  run corp     build_corp.py       # CVM DFP/ITR/FCA/IPE + Yahoo (proventos, splits, perfil)
  wait
) &
# trilha sem Yahoo e sem dependência dos JSONs acima
(
  run rates    build_rates.py      # CDIE: DI1 (B3 BDI) + Copom (BCB) + Focus por reunião; curvas GC
  run news     build_news.py       # RSS de licença aberta (Agência Brasil, BCB, CVM, SEC, Fed, RFB)
  run anb      build_anb.py        # CVM Informe Diário de fundos → captação líquida por classe
  run fns1     build_fns1.py       # BEIR, USMM, CBR, CRYP
  run fns3     build_fns3.py       # FIIM (CVM informe mensal de FII + COTAHIST), FNDS, BKS
  run fns2     build_fns2.py       # COT (CFTC), 13F (SEC EDGAR)
) &
wait

# ---- fase 2 -------------------------------------------------------------------------------------------
(
  run extra    build_extra.py      # GIP, GLCO, ECFC, ECST, HDS, FA, screener EQS/RV/MOST (universe, corp_index)
  run macro    build_macro.py      # WB, FOMC, WIRP, TAYL, ECO, FXFC, FXC, GMM (rates + markets + extra)
  run credit   build_credit.py     # YAS, DRSK, ECTR (rates + screener do extra)
) &
(
  run sec      build_sec.py        # ações dos EUA: SEC EDGAR + Yahoo (preço bruto, proventos) → corp/ dos EUA
  STEP_TIMEOUT=1500 run des build_des.py  # DES de FIIs, ETFs B3, BDRs, ETFs EUA (tickers.json + corp/ do corp e do sec)
) &
wait

# ---- fase 3 (usa tudo acima) ----------------------------------------------------------------------------
run slim     build_slim.py       # prices/r/ (≈2 anos), weekly/ e rrg.json: arquivos enxutos que o site lê primeiro
run coverage build_coverage.py   # tickers.json: quais ativos têm DES/FUND/HDS/FA/OMON/GIP
run alerts   build_alerts.py     # avalia alerts.yaml → alerts.json + $QT_ALERTS_MD se disparar (usa os preços novos)

FAILED=()
[ -f "$LOGS/FAILED" ] && mapfile -t FAILED < "$LOGS/FAILED"
echo "Tempo total do pipeline: $((SECONDS - T_ALL))s"
echo "Saída: $QT_DATA_OUT"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Etapas com falha: ${FAILED[*]}"
  # só falha o job se os preços (base de quase todas as telas) não atualizaram
  for f in "${FAILED[@]}"; do [ "$f" = "prices" ] && exit 1; done
fi
exit 0
