#!/usr/bin/env bash
# Dispara a próxima execução do live.yml e só considera sucesso quando ela fica in_progress.
# Nova tentativa se o comando de disparo falhar, a execução não aparecer, ou cair em startup_failure.
# Uso: bash pipeline/live_chain.sh [watch|standby]
# Env: REPO, GH_TOKEN, RUN_ID (vai em after=).
# Para teste: QT_SLEEP, QT_CHAIN_TRIES, QT_CHAIN_WAIT, QT_CHAIN_POLL, QT_CHAIN_RETRY_WAIT.
set -u
mode=${1:-watch}
case "$mode" in watch|standby) ;; *) echo "mode inválido: $mode" >&2; exit 1;; esac
case "${RUN_ID:-0}" in ''|*[!0-9]*) RUN_ID=0;; esac
tries=${QT_CHAIN_TRIES:-12}
wait_s=${QT_CHAIN_WAIT:-600}
poll=${QT_CHAIN_POLL:-10}
retry_wait=${QT_CHAIN_RETRY_WAIT:-30}
_sleep=${QT_SLEEP:-sleep}
[ "$wait_s" -lt 1 ] && wait_s=1
[ "$poll" -lt 1 ] && poll=1

runs() {
  gh run list -R "$REPO" -w live.yml --limit 30 --json databaseId,status,conclusion \
    -q '.[] | "\(.databaseId) \(.status) \(.conclusion // "-")"' 2>/dev/null || true
}

before=' '
while read -r id st co; do
  [ -n "${id:-}" ] && before="$before$id "
done <<GHRUNS
$(runs)
GHRUNS

while read -r id st co; do
  [ -z "${id:-}" ] && continue
  if [ "$st" = in_progress ] && [ "$id" != "$RUN_ID" ]; then
    echo "já há execução $id em andamento: não dispara outra"
    exit 0
  fi
done <<GHRUNS
$(runs)
GHRUNS

attempt=0
while [ "$attempt" -lt "$tries" ]; do
  attempt=$((attempt + 1))
  echo "disparo $mode (tentativa $attempt/$tries), after=$RUN_ID"
  if ! gh workflow run live.yml -R "$REPO" --ref main -f after="$RUN_ID" -f mode="$mode"; then
    echo "comando de disparo falhou"
    [ "$attempt" -lt "$tries" ] && $_sleep "$retry_wait"
    continue
  fi
  elapsed=0
  failed=
  while [ "$elapsed" -lt "$wait_s" ]; do
    $_sleep "$poll"
    elapsed=$((elapsed + poll))
    failed=
    while read -r id st co; do
      [ -z "${id:-}" ] && continue
      case "$before" in *" $id "*) continue ;; esac
      echo "execução $id: $st ${co:-}"
      if [ "$st" = in_progress ]; then
        echo "próxima em andamento ($id)"
        exit 0
      fi
      if [ "$st" = completed ] && [ "$co" = startup_failure ]; then
        echo "startup_failure em $id: novo disparo"
        before="$before$id "
        failed=startup
        break
      fi
      if [ "$st" = completed ]; then
        # começou e terminou (porteiro saiu, ou falha de verdade): não é startup_failure; não entra em laço
        echo "execução $id concluiu ($co) — não tenta de novo"
        exit 0
      fi
    done <<GHRUNS
$(runs)
GHRUNS
    [ "$failed" = startup ] && break
  done
  [ "$failed" = startup ] && { [ "$attempt" -lt "$tries" ] && $_sleep "$retry_wait"; continue; }
  echo "execução nova não ficou in_progress a tempo; nova tentativa"
  [ "$attempt" -lt "$tries" ] && $_sleep "$retry_wait"
done
echo "não foi possível encadear após $tries tentativas; a rede de segurança cobre"
exit 0
