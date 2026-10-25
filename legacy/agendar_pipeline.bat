@echo off
REM Cria o deployment do pipeline principal
prefect deployment build backend/data_pipeline/flows/daily_flow.py:daily_flow -n "Diário 7h" --cron "0 7 * * *" --apply

REM Inicia o agente Prefect (deixe rodando em um terminal separado para monitorar execuções)
start cmd /k "prefect agent start"
pause