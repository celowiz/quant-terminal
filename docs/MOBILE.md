# Quant Terminal — proposta mobile (<1024px), não implementada
Hoje (390×844): a página rola verticalmente (ok), rodapé no fim. Problemas: overflow horizontal da página em GPC (533px) e FA (499px), causado pelo nome da empresa na barra de ticker e pelo cabeçalho do FnScreen (título + botões); EQS corta colunas da tabela; home ok (lista em 1 coluna).
Proposta (estilo "Anywhere"):
1. Barra de comando (função + ticker) sticky no topo, altura ~44px; nome da empresa truncado com reticências; engrenagem no menu.
2. Rolagem de página permitida; o rodapé fica no fim do conteúdo (não fixo).
3. Painéis empilhados em 1 coluna, na ordem da tela de desktop; KPIs em grade de 2 colunas.
4. Gráficos com altura fixa (~300px preço, ~110px volume/indicador), legenda recolhível, sem o "scale-to-fit".
5. Tabelas largas: scroll horizontal dentro do painel, primeira coluna (ticker/conta) e cabeçalho sticky; tabelas longas limitadas a ~60vh com scroll interno.
6. Abas e botões de período em faixa com scroll horizontal (sem quebrar linha); filtros (EQS) num drawer "Filtros".
7. Cabeçalho do FnScreen em 2 linhas: código+título / controles. Notas/fonte recolhíveis ("Fonte e notas ▸").
8. Toque: crosshair por toque longo, sem hover obrigatório (tooltips do HEAT/RRG via tap).
9. Tablet 768–1023: 2 colunas onde houver grid; mesmos princípios.
