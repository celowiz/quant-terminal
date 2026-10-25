// favicon (tecla âmbar "QT"): arquivos em public/, com basePath explícito (metadata não prefixa o basePath)
const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'
// SEO/compartilhamento: URLs absolutas do site publicado (o basePath /quant-terminal já está em SITE)
const SITE = 'https://celowiz.github.io/quant-terminal/'
const DESC = 'Terminal financeiro no navegador, com funções no estilo de terminal profissional (gráficos, RRG, curva DI/Copom, demonstrações da CVM, opções, screener) e dados reais de fontes abertas (B3, CVM, BCB, FRED, Yahoo Finance) atualizados todo dia útil. Projeto de Marcelo Wizenberg.'
const OG_TITLE = 'Quant Terminal · Um terminal financeiro com dados abertos'
const OG_DESC = 'Gráficos, RRG, curva DI/Copom, demonstrações da CVM, opções e screener de ações da B3, com dados reais atualizados diariamente.'
export const metadata = {
  metadataBase: new URL(SITE),
  title: 'Quant Terminal · Terminal financeiro com dados abertos — Marcelo Wizenberg',
  description: DESC,
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website', locale: 'pt_BR', siteName: 'Marcelo Wizenberg', url: SITE,
    title: OG_TITLE, description: OG_DESC,
    images: [{ url: `${SITE}og.png`, width: 1200, height: 630, type: 'image/png', alt: 'Quant Terminal · celowiz.github.io/quant-terminal' }],
  },
  twitter: { card: 'summary_large_image', title: OG_TITLE, description: OG_DESC, images: [`${SITE}og.png`] },
  icons: {
    icon: [
      { url: `${BP}/favicon.svg`, type: 'image/svg+xml' },
      { url: `${BP}/favicon-32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${BP}/favicon-16.png`, sizes: '16x16', type: 'image/png' },
    ],
    shortcut: `${BP}/favicon.ico`,
    apple: { url: `${BP}/apple-touch-icon.png`, sizes: '180x180' },
  },
}

import './globals.css'
import TopBar from '../components/TopBar'
import Footer from '../components/Footer'
import SettingsRoot from '../components/SettingsRoot'
import Analytics from '../components/Analytics'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden bg-[#0b0c10] font-sans antialiased flex flex-col" suppressHydrationWarning={true}>
        <SettingsRoot>
        <header className="shrink-0 max-lg:sticky max-lg:top-0 max-lg:z-40">
          <TopBar />
        </header>
        <main className="flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden text-slate-100 pt-4 sm:pt-6">{children}</main>
        <Footer />
        </SettingsRoot>
        <Analytics />
      </body>
    </html>
  )
}


