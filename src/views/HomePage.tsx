 
import { FUNCTION_LIST } from '../constants/functions'
import { go } from '../lib/static'

function HomePage() {
  const columns = 4
  const perCol = Math.ceil(FUNCTION_LIST.length / columns)
  const groups = Array.from({ length: columns }, (_, i) => FUNCTION_LIST.slice(i * perCol, (i + 1) * perCol))

  const handleFunctionClick = (functionCode: string) => {
    if (functionCode === '') {
      go('/')
    } else {
      go(`/${functionCode.toLowerCase()}`)
    }
  }

  return (
    <>
      <main className="flex items-center justify-center p-0 sm:p-0 bg-bb-bg text-slate-100 lg:flex-1 lg:min-h-0">
        <section className="w-full max-w-4xl lg:max-w-6xl bg-bb-panel shadow-xl shadow-black/50 border border-bb-border rounded-md p-6 sm:p-8 lg:p-5 text-justify">
          <div className="w-full flex justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-bb-accent text-center">Bem-vindo ao Terminal Quant</h1>
          </div>
          <p className="text-sm sm:text-base leading-7 lg:leading-6 text-slate-100 mt-4 mb-4 lg:mt-2 lg:mb-3">
            Este terminal simula a experiência de um terminal financeiro profissional para análise de ativos financeiros.
            Use o campo de função acima para escolher o tipo de análise (ex: <span className="bg-[#00A8FF] text-black font-bold px-1 rounded">GP</span> para gráfico de linha, <span className="bg-[#00A8FF] text-black font-bold px-1 rounded">GPC</span> para candles, etc).
            Selecione um ticker para visualizar o histórico de preços e indicadores.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
            {groups.map((col, idx) => (
              <ul key={idx} className="list-none space-y-2 lg:space-y-1 text-sm sm:text-base lg:text-sm">
                {col.map((f) => (
                  <li key={f.code} className="flex items-center">
                    <span 
                      className={`mr-2 bg-[#FFA028] text-black font-bold px-1 rounded cursor-pointer hover:bg-[#ffb347] transition-colors duration-200`}
                      onClick={() => handleFunctionClick(f.code)}
                    >
                      {f.code || 'HOME'}
                    </span>
                    <span className="text-slate-200">{f.desc}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
          <p className="mt-4 lg:mt-3 text-bb-yellow block text-center mx-auto rounded bg-slate-800/60 px-4 py-2">Dica: Você pode digitar o ticker ou função e pressionar <b>ENTER</b> para navegar rapidamente!</p>
        </section>
      </main>
    </>
  );
}

export default HomePage; 