#!/usr/bin/env bash
# Porteiro do watcher (live.yml). Decide se esta execução roda, espera ou encadeia a noite,
# e grava go, slept, standby, sleep_s, next_mode em $GITHUB_OUTPUT.
#  - dias úteis 07:00–22:00 BRT: roda o watcher, se não houver execução mais antiga em andamento
#    (a que disparou esta não conta);
#  - até 5 h antes das 07:00 do próximo dia útil (qualquer dia, inclusive madrugada e fim de semana
#    perto da abertura): se ninguém mais estiver esperando/rodando, dorme até 07:00 e vira o watcher —
#    o início do dia não depende de cron (o agendamento deste repo atrasa horas ou simplesmente não dispara);
#  - mais de 5 h até a abertura: espera noturna (standby) — o passo do workflow dorme um bloco
#    (~5 h 05, 15 min antes do teto de ~5 h 20, abaixo do limite de 6 h) e dispara o próximo elo;
#    sexta à noite encadeia até segunda 07:00;
#  - se já houver watcher ou espera ativa: sai em segundos (rede de segurança).
# Constantes (segundos): REACH_MAX = 5 h (cabe dormir até 07:00 e ainda virar o watcher neste job);
#   CHUNK = 5 h 20; AHEAD = 15 min (o próximo é disparado antes do fim do sono, com tempo de
#   observar startup_failure e tentar de novo).
# Para teste: QT_NOW_DOW (1=seg … 7=dom), QT_NOW_HM (HHMM), QT_SLEEP (comando no lugar de sleep), gh no PATH.
set -u
REACH_MAX=$((5 * 3600))
CHUNK=$((5 * 3600 + 20 * 60))
AHEAD=$((15 * 60))
dow=${QT_NOW_DOW:-$(TZ=America/Sao_Paulo date +%u)}
hm=${QT_NOW_HM:-$(TZ=America/Sao_Paulo date +%H%M)}
case "${AFTER:-0}" in ''|*[!0-9]*) AFTER=0;; esac
RUN_ID=${RUN_ID:-0}; out=${GITHUB_OUTPUT:-/dev/stdout}

# Minutos até as 07:00 BRT do próximo dia útil (seg–sex).
until_open_min() {
  local d=$1 tm=$2 days
  if [ "$d" -le 5 ] && [ "$tm" -lt 420 ]; then echo $((420 - tm)); return; fi
  if [ "$d" -le 4 ]; then days=1
  elif [ "$d" -eq 5 ]; then days=3
  elif [ "$d" -eq 6 ]; then days=2
  else days=1
  fi
  echo $((1440 - tm + (days - 1) * 1440 + 420))
}

older() {
  local n
  n=$(gh run list -R "$REPO" -w live.yml --status in_progress --limit 30 --json databaseId \
      -q "[.[] | select(.databaseId < $RUN_ID and .databaseId != $AFTER)] | length" 2>/dev/null) || n=0
  case "$n" in ''|*[!0-9]*) n=0;; esac
  echo "$n"
}

go=false; slept=0; standby=false; sleep_s=0; next_mode=watch
t=$((10#${hm:0:2} * 60 + 10#${hm:2:2}))

if [ "$(older)" -gt 0 ]; then
  echo "outra execução já está ativa ou esperando"
elif [ "$dow" -le 5 ] && [ "$t" -ge 420 ] && [ "$t" -lt 1320 ]; then
  go=true
  echo "na janela ($dow $hm BRT)"
else
  u=$(( $(until_open_min "$dow" "$t") * 60 ))
  if [ "$u" -le "$REACH_MAX" ]; then
    slept=$u
    echo "fora da janela ($dow $hm BRT): espera ${slept}s até 07:00"
    ${QT_SLEEP:-sleep} "$slept"
    go=true
  else
    standby=true
    next_mode=standby
    cap=$CHUNK
    [ "$u" -lt "$CHUNK" ] && cap=$u
    sleep_s=$((cap - AHEAD))
    [ "$sleep_s" -lt 60 ] && sleep_s=60
    echo "espera noturna ${sleep_s}s ($dow $hm BRT; abertura em $((u / 60)) min); em seguida dispara standby"
  fi
fi
echo "go=$go" >> "$out"
echo "slept=$slept" >> "$out"
echo "standby=$standby" >> "$out"
echo "sleep_s=$sleep_s" >> "$out"
echo "next_mode=$next_mode" >> "$out"
