import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-4">
      <div className="text-6xl mb-4">🤔</div>
      <h2 className="text-2xl font-bold mb-2">ページが見つかりません</h2>
      <p className="mb-8 text-gray-600 text-center">
        お探しのページは削除されたか、URLが間違っている可能性があります。<br />
        あるいは、まだ誰も問うていない「答えのない問い」かもしれません。
      </p>
      <Link href="/">
        <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-full shadow-md hover:bg-blue-700 transition">
          ホームに戻る
        </button>
      </Link>
    </div>
  )
}