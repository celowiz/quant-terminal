'use client'
import GPCPage from '../../../pages/GPCPage'

export default function Page({ params }: { params: { ticker: string } }) {
  return <GPCPage ticker={params.ticker} />
}


