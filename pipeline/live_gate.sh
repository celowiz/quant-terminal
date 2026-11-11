#!/usr/bin/env bash
# Porteiro do watcher (live.yml). Decide se esta execução roda e grava go=true|false e slept=N em $GITHUB_OUTPUT.
#  - dias úteis 07:00–22:00 BRT: roda, se não houver execução mais antiga em andamento (a que disparou esta não conta);
#  - dias úteis 05:00–07:00 BRT: se ninguém mais estiver esperando/rodando, dorme até 07:00 e então roda — assim o
#    início do dia não depende de um cron que chegue na hora (o agendamento deste repo atrasa horas);
#  - fora disso: sai.
# Para teste: QT_NOW_DOW (1=seg … 7=dom), QT_NOW_HM (HHMM), QT_SLEEP (comando no lugar de sleep), gh no PATH.
set -u
dow=${QT_NOW_DOW:-$(TZ=America/Sao_Paulo date +%u)}
hm=${QT_NOW_HM:-$(TZ=America/Sao_Paulo date +%H%M)}
case "${AFTER:-0}" in ''|*[!0-9]*) AFTER=0;; esac
RUN_ID=${RUN_ID:-0}; out=${GITHUB_OUTPUT:-/dev/stdout}
older() {
  local n
  n=$(gh run list -R "$REPO" -w live.yml --status in_progress --limit 30 --json databaseId \
      -q "[.[] | select(.databaseId < $RUN_ID and .databaseId != $AFTER)] | length" 2>/dev/null) || n=0
  case "$n" in ''|*[!0-9]*) n=0;; esac
  echo "$n"
}
go=false; slept=0
t=$((10#${hm:0:2} * 60 + 10#${hm:2:2}))
if [ "$dow" -le 5 ] && [ "$t" -ge 300 ] && [ "$t" -lt 420 ]; then
  if [ "$(older)" -gt 0 ]; then echo "cedo ($hm BRT): outra execução já está esperando ou ativa"
  else
    slept=$(( (420 - t) * 60 )); echo "cedo ($hm BRT): espera ${slept}s até 07:00"
    ${QT_SLEEP:-sleep} "$slept"; t=420
  fi
fi
if [ "$dow" -le 5 ] && [ "$t" -ge 420 ] && [ "$t" -lt 1320 ]; then
  if [ "$(older)" -gt 0 ]; then echo "outra execução já está ativa"; else go=true; fi
elif [ "$t" -lt 300 ] || [ "$t" -ge 1320 ] || [ "$dow" -gt 5 ]; then
  echo "fora da janela ($dow $hm BRT)"
fi
echo "go=$go" >> "$out"; echo "slept=$slept" >> "$out"
