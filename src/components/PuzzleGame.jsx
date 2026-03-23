import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import ResultCard from './ResultCard'

const PIECE_IMAGE_MODULES = import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

const GRID_SIZE = 4
const PUZZLE_SIZE_PX = 22 * 96
const GAME_DURATION_SECONDS = 60
const SNAP_DISTANCE = 35
const PLACED_Z_INDEX = 1
const PIECE_RENDER_SCALE = 1
const GLOBAL_IMAGE_SCALE = 1.7

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getPieceSources(pieceFolder) {
  return Object.entries(PIECE_IMAGE_MODULES)
    .filter(([path]) => path.startsWith(`../assets/${pieceFolder}/`))
    .map(([path, src]) => {
      const match = path.match(/\/(\d+)\.(png|jpg|jpeg|webp)$/i)

      return match
        ? {
          id: Number(match[1]),
          src,
        }
        : null
    })
    .filter(Boolean)
    .sort((firstPiece, secondPiece) => firstPiece.id - secondPiece.id)
}

function getVisualPieceMetrics(pieceSize, renderScale) {
  const width = pieceSize.width * renderScale
  const height = pieceSize.height * renderScale

  return {
    width,
    height,
    extraX: width - pieceSize.width,
    extraY: height - pieceSize.height,
  }
}

function getPlacedStride(pieceSize) {
  return {
    x: pieceSize.width,
    y: pieceSize.height,
  }
}

function getPieceTopLeft(
  column,
  row,
  boardOffset,
  pieceSize,
  renderScale,
  layoutMode = 'floating',
) {
  const visualMetrics = getVisualPieceMetrics(pieceSize, renderScale)

  if (layoutMode === 'placed') {
    const placedStride = getPlacedStride(pieceSize)

    return {
      x: boardOffset.x + column * placedStride.x,
      y: boardOffset.y + row * placedStride.y,
    }
  }

  const anchorX = boardOffset.x + column * pieceSize.width
  const anchorY = boardOffset.y + row * pieceSize.height

  let shiftX = visualMetrics.extraX / 2
  let shiftY = visualMetrics.extraY / 2

  if (column === 0) {
    shiftX = 0
  } else if (column === GRID_SIZE - 1) {
    shiftX = visualMetrics.extraX
  }

  if (row === 0) {
    shiftY = 0
  } else if (row === GRID_SIZE - 1) {
    shiftY = visualMetrics.extraY
  }

  return {
    x: anchorX - shiftX,
    y: anchorY - shiftY,
  }
}

function createInitialPieces(pieceSources) {
  return pieceSources.map(({ id, src }) => ({
    id,
    src,
    correctRow: Math.floor((id - 1) / GRID_SIZE),
    correctCol: (id - 1) % GRID_SIZE,
    x: 0,
    y: 0,
    placed: false,
    zIndex: id,
  }))
}

function getTargetPosition(piece, boardOffset, pieceSize) {
  return getPieceTopLeft(
    piece.correctCol,
    piece.correctRow,
    boardOffset,
    pieceSize,
    PIECE_RENDER_SCALE,
    'placed',
  )
}

function getRelativeOffset(stageRect, targetRect) {
  return {
    x: targetRect.left - stageRect.left,
    y: targetRect.top - stageRect.top,
  }
}

function getRelativeBounds(stageRect, targetRect) {
  const offset = getRelativeOffset(stageRect, targetRect)

  return {
    x: offset.x,
    y: offset.y,
    width: targetRect.width,
    height: targetRect.height,
  }
}

function clampPieceToBounds(position, bounds, visualMetrics) {
  return {
    x: clamp(position.x, bounds.x, bounds.x + bounds.width - visualMetrics.width),
    y: clamp(position.y, bounds.y, bounds.y + bounds.height - visualMetrics.height),
  }
}

function isPointInsideBounds(point, bounds) {
  return (
    point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height
  )
}

function shuffleArray(items) {
  const nextItems = [...items]

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentValue = nextItems[index]
    nextItems[index] = nextItems[randomIndex]
    nextItems[randomIndex] = currentValue
  }

  return nextItems
}

function createSolvedPieces(pieceSources, boardOffset, pieceSize) {
  return createInitialPieces(pieceSources).map((piece) => {
    const target = getTargetPosition(piece, boardOffset, pieceSize)

    return {
      ...piece,
      x: target.x,
      y: target.y,
      placed: true,
      zIndex: PLACED_Z_INDEX,
    }
  })
}

function layoutPiecesInTray(
  pieces,
  stageRect,
  trayRect,
  pieceSize,
  { shuffle = true, resetPlaced = true } = {},
) {
  const trayOffset = getRelativeOffset(stageRect, trayRect)
  const visualMetrics = getVisualPieceMetrics(pieceSize, PIECE_RENDER_SCALE)
  const trayPaddingX = Math.max(pieceSize.width * 0.12, 18)
  const trayPaddingY = Math.max(pieceSize.height * 0.1, 16)
  const trayInnerWidth = Math.max(trayRect.width - trayPaddingX * 2, pieceSize.width)
  const trayInnerHeight = Math.max(trayRect.height - trayPaddingY * 2, pieceSize.height)
  const loosePieces = shuffle
    ? shuffleArray(pieces.filter((piece) => resetPlaced || !piece.placed))
    : pieces.filter((piece) => resetPlaced || !piece.placed)
  const piecesPerRow = Math.max(1, Math.ceil(Math.sqrt(loosePieces.length || 1)))
  const totalRows = Math.max(1, Math.ceil((loosePieces.length || 1) / piecesPerRow))
  const stepX = piecesPerRow > 1 ? (trayInnerWidth - visualMetrics.width) / (piecesPerRow - 1) : 0
  const stepY = totalRows > 1 ? (trayInnerHeight - visualMetrics.height) / (totalRows - 1) : 0
  const positionedLoosePieces = new Map()

  loosePieces.forEach((piece, index) => {
    const row = Math.floor(index / piecesPerRow)
    const column = index % piecesPerRow
    const baseX = trayOffset.x + trayPaddingX + column * stepX
    const baseY = trayOffset.y + trayPaddingY + row * stepY
    const randomShiftX = (Math.random() - 0.5) * Math.min(stepX || pieceSize.width * 0.18, pieceSize.width * 0.14)
    const randomShiftY = (Math.random() - 0.5) * Math.min(stepY || pieceSize.height * 0.16, pieceSize.height * 0.12)
    const minX = trayOffset.x + 8
    const maxX = trayOffset.x + trayRect.width - visualMetrics.width - 8
    const minY = trayOffset.y + 8
    const maxY = trayOffset.y + trayRect.height - visualMetrics.height - 8

    positionedLoosePieces.set(piece.id, {
      ...piece,
      x: clamp(baseX + randomShiftX, minX, maxX),
      y: clamp(baseY + randomShiftY, minY, maxY),
      placed: resetPlaced ? false : piece.placed,
      zIndex: index + 2,
    })
  })

  return pieces.map((piece) => positionedLoosePieces.get(piece.id) ?? piece)
}

function isPieceInsideBounds(piece, bounds, visualMetrics) {
  const pieceCenter = {
    x: piece.x + visualMetrics.width / 2,
    y: piece.y + visualMetrics.height / 2,
  }

  return isPointInsideBounds(pieceCenter, bounds)
}

function shuffleTrayPiecesOnly(
  pieces,
  stageRect,
  trayRect,
  pieceSize,
) {
  const trayBounds = getRelativeBounds(stageRect, trayRect)
  const visualMetrics = getVisualPieceMetrics(pieceSize, PIECE_RENDER_SCALE)
  const trayPieces = pieces.filter(
    (piece) => !piece.placed && isPieceInsideBounds(piece, trayBounds, visualMetrics),
  )

  if (trayPieces.length === 0) {
    return pieces
  }

  const shuffledTrayPieces = layoutPiecesInTray(
    trayPieces,
    stageRect,
    trayRect,
    pieceSize,
    { shuffle: true, resetPlaced: false },
  )

  const shuffledTrayMap = new Map(
    shuffledTrayPieces.map((piece) => [piece.id, piece]),
  )

  return pieces.map((piece) => shuffledTrayMap.get(piece.id) ?? piece)
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`
}

function RestartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7 sm:h-8 sm:w-8"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 7a8 8 0 1 1-1.6 9.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="M7 3v4.8h4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  )
}

function PuzzleGame({
  title,
  logoSrc,
  logoAlt = title,
  pieceFolder,
  emptyMessage = 'Agrega las imagenes numeradas en esta carpeta para activar este rompecabezas.',
}) {
  const stageRef = useRef(null)
  const boardRef = useRef(null)
  const trayRef = useRef(null)
  const dragRef = useRef(null)
  const pieceSources = useMemo(() => getPieceSources(pieceFolder), [pieceFolder])
  const totalPieces = pieceSources.length
  const hasPieces = totalPieces > 0

  const [pieces, setPieces] = useState([])
  const [pieceSize, setPieceSize] = useState({ width: 0, height: 0 })
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 })
  const [layoutReady, setLayoutReady] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS)
  const [timeUp, setTimeUp] = useState(false)
  const [completionTime, setCompletionTime] = useState(null)
  const hasCelebratedRef = useRef(false)

  const placedCount = useMemo(
    () => pieces.filter((piece) => piece.placed).length,
    [pieces],
  )

  const visualPieceMetrics = useMemo(() => {
    if (!pieceSize.width || !pieceSize.height || !boardSize.width || !boardSize.height) {
      return { width: 0, height: 0, extraX: 0, extraY: 0 }
    }

    return getVisualPieceMetrics(pieceSize, PIECE_RENDER_SCALE)
  }, [boardSize.height, boardSize.width, pieceSize.height, pieceSize.width])

  const isComplete = hasPieces && pieces.length > 0 && placedCount === totalPieces
  const hasWon = hasStarted && isComplete && !timeUp

  useEffect(() => {
    setPieces([])
    setPieceSize({ width: 0, height: 0 })
    setBoardSize({ width: 0, height: 0 })
    setBoardOffset({ x: 0, y: 0 })
    setLayoutReady(false)
    setHasStarted(false)
    setStartTime(null)
    setElapsedTime(0)
    setTimeLeft(GAME_DURATION_SECONDS)
    setTimeUp(false)
    setCompletionTime(null)
    hasCelebratedRef.current = false
    dragRef.current = null
  }, [pieceFolder])

  useEffect(() => {
    let intervalId

    if (hasStarted && startTime && !isComplete && !timeUp && hasPieces) {
      intervalId = window.setInterval(() => {
        const nextElapsedTime = Math.floor((Date.now() - startTime) / 1000)
        setElapsedTime(nextElapsedTime)
        setTimeLeft(() => {
          const remainingSeconds = Math.max(
            GAME_DURATION_SECONDS - nextElapsedTime,
            0,
          )

          if (remainingSeconds === 0) {
            setTimeUp(true)
            return 0
          }

          return remainingSeconds
        })
      }, 1000)
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [hasPieces, hasStarted, isComplete, startTime, timeUp])

  useEffect(() => {
    const stage = stageRef.current
    const board = boardRef.current
    const tray = trayRef.current

    if (!stage || !board || !tray) {
      return undefined
    }

    const measureLayout = () => {
      const stageRect = stage.getBoundingClientRect()
      const boardRect = board.getBoundingClientRect()
      const trayRect = tray.getBoundingClientRect()
      const nextBoardOffset = getRelativeOffset(stageRect, boardRect)

      const nextPieceSize = {
        width: boardRect.width / GRID_SIZE,
        height: boardRect.height / GRID_SIZE,
      }

      setBoardOffset(nextBoardOffset)
      setPieceSize(nextPieceSize)
      setBoardSize({
        width: boardRect.width,
        height: boardRect.height,
      })

      setPieces((currentPieces) => {
        if (!hasPieces) {
          return []
        }

        if (currentPieces.length === 0) {
          return createSolvedPieces(pieceSources, nextBoardOffset, nextPieceSize)
        }

        const resizedPieces = hasStarted
          ? layoutPiecesInTray(
            currentPieces,
            stageRect,
            trayRect,
            nextPieceSize,
            { shuffle: false, resetPlaced: false },
          )
          : currentPieces

        return resizedPieces.map((piece) => {
          if (!piece.placed) {
            return piece
          }

          const target = getTargetPosition(piece, nextBoardOffset, nextPieceSize)

          return {
            ...piece,
            x: target.x,
            y: target.y,
            zIndex: PLACED_Z_INDEX,
          }
        })
      })

      setLayoutReady(true)
    }

    measureLayout()

    const observer = new ResizeObserver(() => {
      measureLayout()
    })

    observer.observe(stage)
    observer.observe(board)
    observer.observe(tray)

    return () => observer.disconnect()
  }, [hasPieces, pieceSources])

  useEffect(() => {
    if (!hasWon || hasCelebratedRef.current) {
      return
    }

    hasCelebratedRef.current = true
    setCompletionTime(elapsedTime)

    const duration = 2200
    const animationEnd = Date.now() + duration
    const defaults = {
      spread: 70,
      startVelocity: 35,
      ticks: 100,
      zIndex: 200,
    }

    const intervalId = window.setInterval(() => {
      const timeLeftForAnimation = animationEnd - Date.now()

      if (timeLeftForAnimation <= 0) {
        window.clearInterval(intervalId)
        return
      }

      const particleCount = 40 * (timeLeftForAnimation / duration)

      confetti({
        ...defaults,
        particleCount,
        origin: { x: 0.15, y: 0.35 },
      })

      confetti({
        ...defaults,
        particleCount,
        origin: { x: 0.85, y: 0.35 },
      })
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [elapsedTime, hasWon])

  useEffect(() => {
    if (!timeUp) {
      return
    }

    dragRef.current = null
  }, [timeUp])

  useEffect(() => {
    if (!hasWon || !startTime) {
      return
    }

    setCompletionTime(Math.floor((Date.now() - startTime) / 1000))
  }, [hasWon, startTime])

  const handlePointerDown = (event, piece) => {
    if (piece.placed || !stageRef.current || !hasStarted || timeUp || isComplete || !hasPieces) {
      return
    }

    const stageRect = stageRef.current.getBoundingClientRect()

    dragRef.current = {
      id: piece.id,
      offsetX: event.clientX - stageRect.left - piece.x,
      offsetY: event.clientY - stageRect.top - piece.y,
    }

    setPieces((currentPieces) => {
      const highestZIndex = currentPieces.reduce(
        (maxValue, currentPiece) => Math.max(maxValue, currentPiece.zIndex),
        0,
      )

      return currentPieces.map((currentPiece) =>
        currentPiece.id === piece.id
          ? { ...currentPiece, zIndex: highestZIndex + 1 }
          : currentPiece,
      )
    })

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (
      !dragRef.current
      || !stageRef.current
      || !pieceSize.width
      || !pieceSize.height
      || timeUp
      || isComplete
    ) {
      return
    }

    const activeDrag = dragRef.current
    const stageRect = stageRef.current.getBoundingClientRect()

    const nextX = clamp(
      event.clientX - stageRect.left - activeDrag.offsetX,
      0,
      stageRect.width - visualPieceMetrics.width,
    )

    const nextY = clamp(
      event.clientY - stageRect.top - activeDrag.offsetY,
      0,
      stageRect.height - visualPieceMetrics.height,
    )

    setPieces((currentPieces) =>
      currentPieces.map((piece) =>
        piece.id === activeDrag.id
          ? { ...piece, x: nextX, y: nextY }
          : piece,
      ),
    )
  }

  const handlePointerUp = () => {
    if (!dragRef.current || timeUp) {
      dragRef.current = null
      return
    }

    const draggedPieceId = dragRef.current.id
    dragRef.current = null

    const stage = stageRef.current
    const board = boardRef.current
    const tray = trayRef.current

    if (!stage || !board || !tray) {
      return
    }

    const stageRect = stage.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    const trayRect = tray.getBoundingClientRect()
    const boardBounds = getRelativeBounds(stageRect, boardRect)
    const trayBounds = getRelativeBounds(stageRect, trayRect)

    setPieces((currentPieces) =>
      currentPieces.map((piece) => {
        if (piece.id !== draggedPieceId || piece.placed) {
          return piece
        }

        const target = getTargetPosition(piece, boardOffset, pieceSize)
        const distance = Math.hypot(piece.x - target.x, piece.y - target.y)

        if (distance <= SNAP_DISTANCE) {
          return {
            ...piece,
            x: target.x,
            y: target.y,
            placed: true,
            zIndex: PLACED_Z_INDEX,
          }
        }

        const pieceCenter = {
          x: piece.x + visualPieceMetrics.width / 2,
          y: piece.y + visualPieceMetrics.height / 2,
        }

        if (isPointInsideBounds(pieceCenter, boardBounds)) {
          const clampedBoardPosition = clampPieceToBounds(
            { x: piece.x, y: piece.y },
            boardBounds,
            visualPieceMetrics,
          )

          return {
            ...piece,
            x: clampedBoardPosition.x,
            y: clampedBoardPosition.y,
          }
        }

        const fallbackTrayPosition = clampPieceToBounds(
          { x: piece.x, y: piece.y },
          trayBounds,
          visualPieceMetrics,
        )

        return {
          ...piece,
          x: fallbackTrayPosition.x,
          y: fallbackTrayPosition.y,
        }
      }),
    )
  }

  const handleStartOrShuffle = () => {
    const stage = stageRef.current
    const tray = trayRef.current

    if (!stage || !tray || !pieceSize.width || !pieceSize.height || !hasPieces) {
      return
    }

    const stageRect = stage.getBoundingClientRect()
    const trayRect = tray.getBoundingClientRect()

    setPieces((currentPieces) => {
      const basePieces = hasStarted
        ? currentPieces
        : createSolvedPieces(pieceSources, boardOffset, pieceSize)

      return hasStarted
        ? shuffleTrayPiecesOnly(
          basePieces,
          stageRect,
          trayRect,
          pieceSize,
        )
        : layoutPiecesInTray(basePieces, stageRect, trayRect, pieceSize)
    })

    // Iniciar debe arrancar el temporizador una sola vez.
    if (!hasStarted) {
      setHasStarted(true)
      setStartTime(Date.now())
      setElapsedTime(0)
      setTimeLeft(GAME_DURATION_SECONDS)
      setTimeUp(false)
      setCompletionTime(null)
      hasCelebratedRef.current = false
    }

    if (timeUp) {
      setTimeUp(false)
    }

    dragRef.current = null
  }

  const handleRestart = () => {
    if (!pieceSize.width || !pieceSize.height || !hasPieces) {
      return
    }

    setPieces(createSolvedPieces(pieceSources, boardOffset, pieceSize))
    setHasStarted(false)
    setStartTime(null)
    setElapsedTime(0)
    setTimeLeft(GAME_DURATION_SECONDS)
    setTimeUp(false)
    setCompletionTime(null)
    hasCelebratedRef.current = false
    dragRef.current = null
  }

  return (
    <section className="rounded-[28px] bg-white px-4 py-5 md:px-6 md:py-6">
      <div className="grid grid-cols-[0.8fr_1.8fr_0.8fr] items-center gap-3 sm:gap-4 lg:gap-6">
        <div className="flex items-center justify-center">
          {/* Espacio reservado para un logo futuro a la izquierda */}
          {/*
          <img
            src={futureLeftLogo}
            alt="Logo izquierdo"
            className="h-12 w-20 object-contain sm:h-14 sm:w-24 lg:h-16 lg:w-28"
          />
          */}
        </div>

        <div className="flex items-center justify-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt}
              className="h-40 w-full max-w-[560px] object-contain sm:h-48 sm:max-w-[680px] lg:h-56 lg:max-w-[820px]"
            />
          ) : (
            <div className="h-40 w-full max-w-[560px] sm:h-48 sm:max-w-[680px] lg:h-56 lg:max-w-[820px]" />
          )}
        </div>

        <div className="flex items-center justify-center">
          {/* Espacio reservado para un logo futuro a la derecha */}
          {/*
          <img
            src={futureRightLogo}
            alt="Logo derecho"
            className="h-12 w-20 object-contain sm:h-14 sm:w-24 lg:h-16 lg:w-28"
          />
          */}
        </div>
      </div>

      <div className="mt-16 text-center sm:mt-20 md:mt-24">
        <h1 className="text-4xl font-bold leading-tight text-stone-900 sm:text-5xl md:text-6xl lg:text-7xl">
          {title}
        </h1>
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="rounded-full bg-amber-50 px-8 py-4 text-2xl font-semibold text-amber-800 ring-1 ring-amber-200 sm:text-3xl md:text-4xl">
            Tiempo Restante: {formatTime(timeLeft)}
          </div>
          {!timeUp && !hasWon && (
            <p className="text-2xl text-stone-600 sm:text-3xl md:text-4xl">
              {placedCount} / {totalPieces} piezas colocadas
            </p>
          )}
          {hasWon && (
            <ResultCard
              details={`Piezas: ${placedCount} | Tiempo: ${formatTime(completionTime ?? elapsedTime)}`}
              title="🎉 ¡Felicitaciones! 🎉"
              tone="success"
            />
          )}
          {timeUp && !hasWon && (
            <ResultCard
              details={`Piezas colocadas: ${placedCount} / ${totalPieces}`}
              title="⏰ ¡Tiempo agotado! ⏰"
              tone="danger"
            />
          )}
          {!hasStarted && !timeUp && !isComplete && hasPieces && (
            <p className="text-xl text-stone-500 sm:text-2xl">
              Pulsa iniciar para comenzar la cuenta regresiva.
            </p>
          )}
          {!hasPieces && (
            <p className="text-xl text-stone-500 sm:text-2xl">
              {emptyMessage}
            </p>
          )}
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="mx-auto w-full max-w-[460px] rounded-[30px] border border-dashed border-amber-300/80 bg-[#fefbf7] p-5 sm:max-w-[620px] md:max-w-[760px] md:p-6 lg:max-w-none">
          <div
            ref={boardRef}
            className="relative mx-auto aspect-square w-full rounded-[22px] bg-white/60"
            style={{ maxWidth: `${PUZZLE_SIZE_PX}px` }}
          />
        </div>

        <aside className="order-2 mx-auto flex h-full w-full max-w-[420px] flex-col rounded-[30px] border border-stone-200/70 bg-white p-5 sm:max-w-[540px] md:max-w-[680px] md:p-6 lg:order-none lg:max-w-none">
          <div
            ref={trayRef}
            className="relative h-[120px] w-full flex-none rounded-[22px] border border-dashed border-amber-300/80 bg-[#fefbf7] sm:h-[150px] md:h-[180px] lg:h-[420px] xl:h-[560px]"
          />

          <div className="mt-auto flex items-center justify-center gap-4 pt-4">
            <button
              className="inline-flex shrink-0 rounded-[16px] bg-amber-500 px-10 py-5 text-lg font-semibold text-white shadow-[0_12px_30px_rgba(180,97,17,0.24)] transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-500 disabled:text-white sm:px-12 sm:py-5 sm:text-xl"
              disabled={!hasPieces || hasWon || timeUp}
              onClick={handleStartOrShuffle}
              type="button"
            >
              {hasPieces ? (hasStarted ? 'Desordenar' : 'Iniciar') : 'Proximamente'}
            </button>

            {(timeUp || hasWon) && (
              <button
                aria-label="Reiniciar rompecabezas"
                className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_30px_rgba(16,185,129,0.3)] transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300 sm:h-18 sm:w-18"
                disabled={!hasPieces}
                onClick={handleRestart}
                type="button"
              >
                <RestartIcon />
              </button>
            )}
          </div>
        </aside>

        {/* Aqui se renderizan las piezas del rompecabezas activo. */}
        {/* Espacio reservado para futuras variantes visuales de piezas o efectos. */}
        {layoutReady &&
          pieces.map((piece) => (
            <button
              className={`absolute overflow-visible bg-transparent transition-transform duration-150 ${
                piece.placed
                  ? 'cursor-default'
                  : 'cursor-grab active:cursor-grabbing'
              }`}
              key={piece.id}
              onPointerCancel={handlePointerUp}
              onPointerDown={(event) => handlePointerDown(event, piece)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                width: `${visualPieceMetrics.width}px`,
                height: `${visualPieceMetrics.height}px`,
                left: `${piece.x}px`,
                top: `${piece.y}px`,
                zIndex: piece.zIndex,
              }}
              type="button"
            >
              <img
                alt={`Pieza ${piece.id}`}
                className="pointer-events-none h-full w-full select-none object-contain"
                draggable="false"
                src={piece.src}
                style={{
                  transform: `scale(${GLOBAL_IMAGE_SCALE})`,
                  transformOrigin: 'center',
                }}
              />
            </button>
          ))}
      </div>

    </section>
  )
}

export default PuzzleGame
