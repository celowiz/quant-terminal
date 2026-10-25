"""ANB (via fonte aberta): captação líquida de fundos por classe a partir do Informe Diário da CVM
(dados.cvm.gov.br, dados abertos), classificada pelo registro de classes da CVM (RCVM 175).
NÃO é a planilha ANBIMA (proprietária, ToS proíbe automação): as categorias são as da CVM."""
import zipfile, datetime as dt
import pandas as pd
from common import save, cached, step, now_iso, today_brt

BASE = 'https://dados.cvm.gov.br/dados/FI'

def anb():
    reg = pd.read_csv(zipfile.ZipFile(cached(f'{BASE}/CAD/DADOS/registro_fundo_classe.zip', 'registro_fundo_classe.zip', 20)).open('registro_classe.csv'),
                      sep=';', encoding='latin1', dtype=str, usecols=['CNPJ_Classe', 'Tipo_Classe', 'Classificacao', 'Classificacao_Anbima'])
    reg['CNPJ_Classe'] = reg.CNPJ_Classe.str.replace(r'\D', '', regex=True).str.zfill(14)
    reg = reg.drop_duplicates('CNPJ_Classe').set_index('CNPJ_Classe')
    today = today_brt(); frames = []
    for i in range(13, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0: m += 12; y -= 1
        name = f'inf_diario_fi_{y}{m:02d}.zip'
        try:
            p = cached(f'{BASE}/DOC/INF_DIARIO/DADOS/{name}', name, 20 if i < 2 else 24 * 30)
        except Exception as e: print('skip', name, e); continue
        z = zipfile.ZipFile(p)
        d = pd.read_csv(z.open(z.namelist()[0]), sep=';', encoding='latin1', dtype={'CNPJ_FUNDO_CLASSE': str, 'TP_FUNDO_CLASSE': str},
                        usecols=['TP_FUNDO_CLASSE', 'CNPJ_FUNDO_CLASSE', 'DT_COMPTC', 'CAPTC_DIA', 'RESG_DIA', 'VL_PATRIM_LIQ'])
        frames.append(d)
    d = pd.concat(frames); d['DT'] = pd.to_datetime(d.DT_COMPTC)
    d['NET'] = (d.CAPTC_DIA.fillna(0) - d.RESG_DIA.fillna(0)) / 1e6
    cn = d.CNPJ_FUNDO_CLASSE.str.replace(r'\D', '', regex=True).str.zfill(14)
    cls = cn.map(reg['Classificacao']).fillna('')
    tipo = cn.map(reg['Tipo_Classe']).fillna(d.TP_FUNDO_CLASSE)
    print('  cobertura do cadastro:', round(float((cls != '').mean()) * 100, 1), '%')
    def label(c, t):
        c = (c or '').strip(); t = (t or '').upper()
        if 'FIDC' in t or 'DIREITOS CREDIT' in t: return 'FIDC'
        if 'FII' in t or 'IMOBILI' in t: return 'Imobiliários (FII)'
        if 'FIP' in t or 'PARTICIPA' in t: return 'Participações (FIP)'
        if c: return {'Renda Fixa': 'Renda Fixa', 'Ações': 'Ações', 'Multimercado': 'Multimercados', 'Cambial': 'Cambial', 'FMP-FGTS': 'FMP-FGTS'}.get(c, c)
        return 'Não classificado'
    d['CLS'] = [label(c, t) for c, t in zip(cls, tipo)]
    last = d.DT.max()
    # último dia com cobertura razoável (o informe chega com defasagem; dias recentes vêm incompletos)
    cnt = d.groupby('DT').size(); full = cnt[cnt >= 0.8 * cnt.tail(30).median()]
    last = full.index.max()
    d = d[d.DT <= last]
    def agg(mask): return d[mask].groupby('CLS').NET.sum()
    day = agg(d.DT == last); mtd = agg((d.DT.dt.year == last.year) & (d.DT.dt.month == last.month))
    ytd = agg(d.DT.dt.year == last.year); m12 = agg(d.DT > last - pd.DateOffset(years=1))
    pl = d[d.DT == last].groupby('CLS').VL_PATRIM_LIQ.sum() / 1e9
    order = ['Renda Fixa', 'Ações', 'Multimercados', 'Cambial', 'FMP-FGTS', 'FIDC', 'Imobiliários (FII)', 'Participações (FIP)', 'Não classificado']
    rows = [{'class_name': c, 'day': round(float(day.get(c, 0)), 2), 'month': round(float(mtd.get(c, 0)), 2), 'year': round(float(ytd.get(c, 0)), 2),
             'twelve_months': round(float(m12.get(c, 0)), 2), 'pl_bi': round(float(pl.get(c, 0)), 1)} for c in order if abs(float(m12.get(c, 0))) + abs(float(day.get(c, 0))) > 0.5]
    tot = {k: round(sum(r[k] for r in rows), 2) for k in ['day', 'month', 'year', 'twelve_months', 'pl_bi']}
    rows.append({'class_name': 'Total', **tot})
    s = d[d.DT > last - pd.Timedelta(days=95)].groupby(['DT', 'CLS']).NET.sum().unstack().fillna(0)
    daily = {'dates': [x.strftime('%Y-%m-%d') for x in s.index], 'series': {c: [round(v, 1) for v in s[c].values] for c in s.columns}}
    mon = d.groupby([d.DT.dt.to_period('M'), 'CLS']).NET.sum().unstack().fillna(0)
    monthly = {'months': [str(x) for x in mon.index], 'series': {c: [round(v, 1) for v in mon[c].values] for c in mon.columns}}
    save('funds_flow.json', {'generated_at': now_iso(), 'data_ref': last.strftime('%d/%m/%Y'), 'unit': 'R$ milhões',
                             'source': 'CVM – Informe Diário de Fundos (dados abertos) + registro de classes CVM (RCVM 175). Captação líquida = captação − resgate. Classificação CVM, não ANBIMA.',
                             'rows': rows, 'daily': daily, 'monthly': monthly})

if __name__ == '__main__':
    step('anb', anb)
