// favicon (tecla âmbar "QT"): arquivos em public/, com basePath explícito (metadata não prefixa o basePath)
const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'
export const metadata = {
  title: 'celowiz • Quant Terminal',
  description: 'Terminal Quant',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-screen lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden bg-[#0b0c10] font-sans antialiased flex flex-col" suppressHydrationWarning={true}>
        <header className="shrink-0">
          <TopBar />
        </header>
        <main className="flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden text-slate-100 pt-4 sm:pt-6">{children}</main>
        <Footer />
      </body>
    </html>
  )
}


