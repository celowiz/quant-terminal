# MOV / HMOV — contribuição por ação no índice

Telas: `MOV` (hoje) e `HMOV` (histórico), em `src/views/fn/mov.tsx`; contas puras em `src/lib/mov.mjs` (testes em
`src/lib/mov.test.mjs`); dados de `pipeline/build_mov.py` (testes em `tests/test_mov.py`) e do watcher (`mov.json`,
ver `docs/LIVE.md`). Índices: IBOV, IBXX (IBrX-100), IBXL (IBrX-50), SMLL, IDIV.

## Método

- O `part` da carteira do dia *d* é o peso de cada ação no fechamento do pregão anterior (conferido contra a teórica).
- O Ibovespa é de **retorno total**: a conta usa fechamentos ajustados por proventos (com o fechamento sem ajuste o erro
  passa de centenas de pontos no ano).
- Contribuição bruta do dia: `raw_i,t = L_{t-1} · w_i,t-1 · r_i,t` (L = fechamento oficial do índice). Os pesos andam com
  os retornos (`w_i,t ∝ w_i,t-1 (1 + r_i,t)`) e voltam à carteira oficial a cada trecho.
- Trechos: um por vigência (primeira segunda-feira útil de jan/mai/set; em 2026: 05/01, 04/05, 08/09) e outro a cada
  mudança de composição dentro da vigência. O peso inicial de cada trecho é o `part` da carteira guardada recuado até o
  início do trecho com o retorno total de cada ação. Carteira de hoje antes do fechamento oficial: a referência é o último
  pregão anterior à data da carteira.
- **Resíduo**: `ε_t = ΔL_t − Σ raw_i,t` (preços que não são todos do mesmo instante, proventos e eventos que a bolsa trata
  do seu jeito). Na tela, `Pontos = raw + (w_i / Σw) · ε_t` por dia, e os Pontos somam a variação oficial do índice;
  `Pts brutos` mostram o valor antes. O total do período aparece em "Resíduo" no topo da tela.
- MOV ao vivo: `L0 = último / (1 + var%)` do índice; contribuições com o `part` do dia e a var. % de cada ação; o resíduo
  vai só para as ações cotadas.
- Período que começa antes do histórico guardado: a tela mostra "—" e a data de início (nunca um número parcial).

## Histórico e sementes

- `mov/archive.json` guarda as carteiras do dia (primeira e última de cada vigência e toda mudança de composição) e é
  restaurado do artefato anterior do Pages a cada build, então cresce sozinho a partir de 11/11/2026.
- Sementes versionadas em `pipeline/data/portfolios/IBOV/` — arquivos oficiais "Carteira do Dia" do Ibovespa, sem edição
  (latin-1; o de 23/03 tem cabeçalho com acentuação quebrada e é lido por posição), achados em repositórios públicos:
  - `2026-01-02.csv` — github.com/JuanVictor-cmd/Dashboard_Moeda (`IBOV.csv`)
  - `2026-03-23.csv` — github.com/GabrielSantos15/brazilian-market-analytics (`dados/dim_ibovespa_assets.csv`)
  - `2026-05-11.csv` — github.com/manuelapp12/Bootcamp-Finor (`data/raw/IBOVDia_11-05-26.csv`)
- `pipeline/data/portfolios/prices_seed.csv` — fechamentos oficiais (COTAHIST da B3, 2025–2026) de ativos que o provedor
  de preços não tem ou perdeu: AXIA6 (ex-ELET6), RAIZ4, CYRE4.
- **Regra do primeiro trecho**: se algum membro tem queda diária > 20% no retorno total dentro do recuo, a série começa no
  dia seguinte (provento em ações / cisão que o ajuste de preço não pega). Por isso o IBOV começa em 23/12/2025 (base
  22/12/2025, distribuição em ações da AXIA): YTD 2026 coberto; **12M só a partir de ~dez/2026**.
- IBXX, IBXL, SMLL e IDIV não têm carteiras antigas guardadas: começam em 04/09/2026 (recuo da carteira de 11/11/2026
  até a vigência de setembro) e crescem com o arquivo.

## Validação (IBOV, 30/12/2025 → 11/11/2026, fechamento 172.341,16)

| ação | referência | bruto | Pontos |
|---|---|---|---|
| PETR4 | +4.814 | +4.830 | +4.770 |
| PETR3 | +4.191 | +4.176 | +4.137 |
| EMBJ3 | +1.375 | +1.352 | +1.331 |
| VALE3 | −1.493 | −1.440 | −1.529 |
| BBDC4 | −961 | −979 | −1.009 |

Σ bruto 12.024,6 vs. variação 11.215,8 (resíduo −808,8 pts, ~7%).

## Prévia da próxima carteira

`mov/preview.json`: no último mês da vigência até a virada, a prévia oficial (`GetQuartelyPreview`) com entradas, saídas
e mudanças de peso; fora da janela, só a data da próxima carteira.
