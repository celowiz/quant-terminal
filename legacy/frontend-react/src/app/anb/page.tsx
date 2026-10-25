'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { FUNCTION_LIST } from '../../constants/functions'

type FundsFlowRow = {
	class_name: string
	day?: number | null
	month?: number | null
	year?: number | null
	twelve_months?: number | null
}

type FundsFlowResponse = {
	data_ref: string
	rows: FundsFlowRow[]
}

function formatPtBR(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ANBPage() {
	const [data, setData] = useState<FundsFlowResponse | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Encontrar a descrição da função ANB na lista de funções
	const functionDesc = useMemo(() => {
		const func = FUNCTION_LIST.find(f => f.code === 'ANB')
		return func ? func.desc : 'Flows of Funds by Category'
	}, [])

	// Atualizar título da página
	usePageTitle(functionDesc)

	useEffect(() => {
		let cancelled = false
		const controller = new AbortController()
		
		const fetchData = async () => {
			try {
				const response = await api.get<FundsFlowResponse>('/funds_flow', {
					signal: controller.signal
				})
				if (!cancelled) {
					setData(response.data)
					setError(null)
				}
			} catch (err: any) {
				if (!cancelled && !controller.signal.aborted) {
					setError(err?.message ?? 'Erro ao carregar dados')
				}
			}
		}

		fetchData()

		return () => {
			cancelled = true
			controller.abort()
		}
	}, [])

	const rows = useMemo(() => data?.rows ?? [], [data])

	return (
		<div className="max-w-5xl mx-auto p-4">
			<h1 className="text-2xl font-semibold mb-2">Captação Líquida (R$ Milhões)</h1>
			{data?.data_ref && (
				<p className="text-sm text-gray-400 mb-4">Referência: {data.data_ref}</p>
			)}
			{error && (
				<div className="text-red-500 mb-4">{error}</div>
			)}
			<div className="overflow-x-auto">
				<table className="min-w-full border border-[#333] rounded-md bg-[#0f1111] text-[#e6e6e6]">
					<thead className="bg-[#1a1a1a]">
						<tr>
							<th className="text-left px-3 py-2 border-b border-[#333]">Classe</th>
							<th className="text-right px-3 py-2 border-b border-[#333]">Dia</th>
							<th className="text-right px-3 py-2 border-b border-[#333]">Mês</th>
							<th className="text-right px-3 py-2 border-b border-[#333]">Ano</th>
							<th className="text-right px-3 py-2 border-b border-[#333]">12 Meses</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r, idx) => {
							const isNegDay = (r.day ?? 0) < 0
							const isNegMonth = (r.month ?? 0) < 0
							const isNegYear = (r.year ?? 0) < 0
							const isNegTwelve = (r.twelve_months ?? 0) < 0
							return (
								<tr key={r.class_name} className={idx % 2 === 0 ? 'bg-[#0f1111]' : 'bg-[#121415]'}>
									<td className="px-3 py-2 border-b border-[#333] text-[#c8c8c8]">{r.class_name}</td>
									<td className={`px-3 py-2 border-b border-[#333] text-right ${isNegDay ? 'text-[#ff5252]' : 'text-[#a8ff60]'}`}>{formatPtBR(r.day ?? null)}</td>
									<td className={`px-3 py-2 border-b border-[#333] text-right ${isNegMonth ? 'text-[#ff5252]' : 'text-[#a8ff60]'}`}>{formatPtBR(r.month ?? null)}</td>
									<td className={`px-3 py-2 border-b border-[#333] text-right ${isNegYear ? 'text-[#ff5252]' : 'text-[#a8ff60]'}`}>{formatPtBR(r.year ?? null)}</td>
									<td className={`px-3 py-2 border-b border-[#333] text-right ${isNegTwelve ? 'text-[#ff5252]' : 'text-[#a8ff60]'}`}>{formatPtBR(r.twelve_months ?? null)}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}


