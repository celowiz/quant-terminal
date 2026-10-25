"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Options = {
  idleMs?: number
  blockWidthPx?: number
}

export function useBlockCaret(
  inputRef: React.RefObject<HTMLInputElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  options: Options = {}
) {
  const { idleMs = 0, blockWidthPx = 8 } = options
  const [showBlock, setShowBlock] = useState(true)
  const [coords, setCoords] = useState({ left: 0, top: 0, height: 0, width: blockWidthPx })
  const idleTimerRef = useRef<number | null>(null)

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const scheduleIdle = useCallback(() => {
    clearIdleTimer()
    if (idleMs <= 0) return
    idleTimerRef.current = window.setTimeout(() => setShowBlock(true), idleMs)
  }, [idleMs])

  const measure = useCallback(() => {
    const input = inputRef.current
    const container = containerRef.current
    if (!input || !container) return

    const cs = window.getComputedStyle(input)
    const font = cs.font
    const paddingLeft = parseFloat(cs.paddingLeft || '0')
    const paddingTop = parseFloat(cs.paddingTop || '0')
    const lineHeight = parseFloat(cs.lineHeight || String(input.clientHeight)) || input.clientHeight

    const selectionStart = input.selectionStart ?? input.value.length
    const textBefore = input.value.slice(0, selectionStart)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    let textWidth = 0
    if (ctx) {
      ctx.font = font
      textWidth = ctx.measureText(textBefore).width
    }

    const inputRect = input.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    const left = inputRect.left - containerRect.left + paddingLeft + textWidth
    const top = inputRect.top - containerRect.top + paddingTop

    setCoords({ left, top, height: lineHeight, width: blockWidthPx })
  }, [blockWidthPx, containerRef, inputRef])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const onFocus = () => {
      setShowBlock(true)
      measure()
      scheduleIdle()
    }
    const onBlur = () => {
      setShowBlock(false)
      clearIdleTimer()
    }
    const onKeyDown = () => {
      // keep block visible while typing
      measure()
    }
    const onInput = () => {
      measure()
      scheduleIdle()
    }

    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)
    input.addEventListener('keydown', onKeyDown)
    input.addEventListener('input', onInput)

    const onResizeOrScroll = () => measure()
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)

    measure()

    return () => {
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)
      input.removeEventListener('keydown', onKeyDown)
      input.removeEventListener('input', onInput)
      window.removeEventListener('resize', onResizeOrScroll)
      window.removeEventListener('scroll', onResizeOrScroll, true)
      clearIdleTimer()
    }
  }, [inputRef, measure, scheduleIdle])

  const style = useMemo(() => ({
    position: 'absolute' as const,
    left: `${coords.left}px`,
    top: `${coords.top}px`,
    width: `${coords.width}px`,
    height: `${coords.height}px`,
    background: '#ffffff',
    pointerEvents: 'none' as const,
    animation: 'bbCaretBlink 1s step-end infinite',
  }), [coords])

  return { caretStyle: style, showBlock }
}

export default useBlockCaret


