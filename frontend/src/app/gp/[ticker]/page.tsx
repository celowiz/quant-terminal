'use client'
import GPPage from '../../../pages/GPPage'

export default function Page({ params }: { params: { ticker: string } }) {
  return <GPPage ticker={params.ticker} />
}


