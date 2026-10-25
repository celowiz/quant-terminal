export const metadata = {
  title: 'celowizBBG • Quant Terminal',
  description: 'Terminal Quant',
}

import './globals.css'
import TopBar from '../components/TopBar'
import Footer from '../components/Footer'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-screen bg-[#0b0c10] font-sans antialiased flex flex-col" suppressHydrationWarning={true}>
        <header className="shrink-0">
          <TopBar />
        </header>
        <main className="flex-1 text-slate-100 pt-4 sm:pt-6">{children}</main>
        <Footer />
      </body>
    </html>
  )
}


