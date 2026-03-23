import { useState } from 'react'
import cohorsilLogo from './assets/cohorsil-logo.png'
import cohorsilPreview from './assets/piezas-cohorsil/cohorsil-vista.png'
import PuzzleGame from './components/PuzzleGame'

const PUZZLE_SECTIONS = [
  {
    id: 'cohorsil',
    title: 'Rompecabezas Cohorsil',
    logoSrc: cohorsilLogo,
    pieceFolder: 'piezas-cohorsil',
    cardLabel: 'Cohorsil',
    previewSrc: cohorsilPreview,
  },
  {
    id: 'banner',
    title: 'Rompecabezas Banner',
    pieceFolder: 'piezas-banner',
    cardLabel: 'Próximamente',
    emptyMessage:
      'Este espacio ya esta listo para cargar el siguiente rompecabezas desde src/assets/piezas-banner.',
  },
  // Espacio reservado para futuros rompecabezas.
  // Ejemplo:
  // {
  //   id: 'nuevo',
  //   title: 'Rompecabezas Nuevo',
  //   pieceFolder: 'pieza-nuevo',
  // },
]

function App() {
  const [selectedPuzzleId, setSelectedPuzzleId] = useState(PUZZLE_SECTIONS[0]?.id ?? '')
  const selectedPuzzle = PUZZLE_SECTIONS.find(
    (puzzleSection) => puzzleSection.id === selectedPuzzleId,
  ) ?? PUZZLE_SECTIONS[0]

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7e8_0%,_#f5e0c7_45%,_#eecb9f_100%)] px-4 py-5 text-stone-800 md:px-6 md:py-8">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-40 rounded-[32px] border border-stone-200/70 bg-white p-4 pb-36 shadow-[0_24px_70px_rgba(88,52,24,0.1)] backdrop-blur md:gap-52 md:p-6 md:pb-44">
        {selectedPuzzle && (
          <PuzzleGame
            emptyMessage={selectedPuzzle.emptyMessage}
            key={selectedPuzzle.id}
            logoSrc={selectedPuzzle.logoSrc}
            pieceFolder={selectedPuzzle.pieceFolder}
            title={selectedPuzzle.title}
          />
        )}

        <section className="rounded-[28px] border border-stone-200/70 bg-white px-4 py-5 md:px-6 md:py-6">
          <h2 className="text-3xl font-semibold text-stone-900 sm:text-4xl">
            Mas Rompecabezas
          </h2>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4 sm:gap-5">
              {PUZZLE_SECTIONS.map((puzzleSection) => {
                const isSelected = puzzleSection.id === selectedPuzzle?.id

                return (
                  <button
                    className={`flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden rounded-[34px] text-center text-lg font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition sm:h-48 sm:w-48 sm:text-xl ${
                      isSelected
                        ? 'bg-stone-300 text-stone-900 shadow-[0_5px_14px_rgba(15,23,42,0.04)]'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                    key={puzzleSection.id}
                    onClick={() => setSelectedPuzzleId(puzzleSection.id)}
                    type="button"
                  >
                    {puzzleSection.previewSrc ? (
                      <img
                        alt={puzzleSection.cardLabel}
                        className="h-full w-full object-cover"
                        src={puzzleSection.previewSrc}
                      />
                    ) : (
                      <span className="px-4">{puzzleSection.cardLabel}</span>
                    )}
                  </button>
                )
              })}

              {/* Espacio reservado para futuras tarjetas de rompecabezas. */}
              {/* Ejemplo visual para agregar otra opcion manualmente:
                  <button className="...">Nuevo</button> */}
            </div>
          </div>
        </section>

        {/* Espacio reservado para llamar mas componentes de rompecabezas si luego
            prefieres separarlos manualmente en lugar de usar la lista superior. */}

        <a
          aria-label="Volver a la libreria de juegos"
          className="absolute bottom-8 left-8 inline-flex h-24 w-24 items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_12px_30px_rgba(180,97,17,0.24)] transition hover:bg-amber-500 md:bottom-10 md:left-10 md:h-28 md:w-28"
          href="https://juegos-cohorsil-libreria.vercel.app/"
        >
          <svg
            aria-hidden="true"
            className="h-12 w-12 md:h-14 md:w-14"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </a>
      </div>
    </main>
  )
}

export default App
