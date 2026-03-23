function ResultCard({ tone = 'success', title, details }) {
  const toneClasses = tone === 'success'
    ? 'from-green-500 to-green-600 text-white'
    : 'from-red-500 to-red-600 text-white'

  return (
    <div className="mt-4 flex w-full justify-center">
      <div
        className={`w-full max-w-2xl rounded-[22px] bg-gradient-to-r px-6 py-5 text-center shadow-lg ${toneClasses}`}
      >
        <h2 className="text-3xl font-bold sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-lg sm:text-2xl">
          {details}
        </p>
      </div>
    </div>
  )
}

export default ResultCard
