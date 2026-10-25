import { FUNCTION_LIST, HOME_COLUMNS, fnName, type FnCategory } from '../constants/functions'
import { catLabel, t } from '../lib/i18n'
import { go } from '../lib/static'
import { navFunction } from '../lib/track'

const Key = ({ c }: { c: string }) => <span className="bg-[#00A8FF] text-black font-bold px-1 rounded">{c}</span>

function HomePage() {
  const open = (code: string) => { navFunction('list', code || 'HOME'); go(code === '' ? '/' : `/${code.toLowerCase()}`) }
  const byCat = (c: FnCategory) => FUNCTION_LIST.filter(f => f.cat === c)

  return (
    <>
      <main className="flex items-center justify-center p-0 sm:p-0 bg-bb-bg text-slate-100 lg:flex-1 lg:min-h-0">
        <section className="w-full max-w-4xl lg:max-w-6xl bg-bb-panel shadow-xl shadow-black/50 border border-bb-border rounded-md p-6 sm:p-8 lg:p-5 text-left">
          <div className="w-full flex justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-bb-accent text-center">{t('home.title')}</h1>
          </div>
          <p className="text-sm sm:text-base leading-7 lg:leading-6 text-slate-100 mt-4 mb-4 lg:mt-2 lg:mb-3 text-left">
            {t('home.p1')} {t('home.p2a')} <Key c="GP" /> {t('home.p2b')} <Key c="GPC" /> {t('home.p2c')} {t('home.p3')}{' '}
            <span className="text-[#FFA028]">{t('home.p4')}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 lg:gap-y-0">
            {HOME_COLUMNS.map((cats, idx) => (
              <div key={idx} className="contents lg:block lg:space-y-2">
                {cats.map(c => (
                  <section key={c} aria-labelledby={`cat-${c}`}>
                    <h2 id={`cat-${c}`} className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#FFA028] border-b border-[#FFA028]/60 pb-0.5 mb-1">
                      {catLabel(c)}
                    </h2>
                    <ul className="list-none space-y-1.5 lg:space-y-0.5 text-sm sm:text-base lg:text-sm text-left">
                      {byCat(c).map(f => (
                        <li key={f.code} className="flex items-baseline">
                          <button type="button" onClick={() => open(f.code)} aria-label={`${f.code || 'HOME'} — ${fnName(f)}`}
                            className="mr-2 shrink-0 bg-[#FFA028] text-black font-bold px-1 rounded cursor-pointer hover:bg-[#ffb347] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                            {f.code || 'HOME'}
                          </button>
                          <span className="text-slate-200 text-left leading-snug">{fnName(f)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-4 lg:mt-3 text-bb-yellow block text-center mx-auto rounded bg-slate-800/60 px-4 py-2">{t('home.tip1')} <b>ENTER</b> {t('home.tip2')}</p>
        </section>
      </main>
    </>
  )
}

export default HomePage
