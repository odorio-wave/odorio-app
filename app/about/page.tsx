import Link from "next/link";

export default function Home() {
  const url = encodeURIComponent("http://localhost:3000"); // 公開時に変更
  const text = encodeURIComponent("このサイトをチェックしてみて！");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">ホームページ</h1>

      {/* SNSシェアボタン */}
      <div className="flex gap-4 mb-6">
        {/* X (旧Twitter) */}
        <Link
          href={`https://x.com/intent/tweet?url=${url}&text=${text}`}
          target="_blank"
        >
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-black text-white font-bold text-lg shadow">
            X
          </button>
        </Link>

        {/* Facebook */}
        <Link
          href={`https://www.facebook.com/sharer/sharer.php?u=${url}`}
          target="_blank"
        >
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg shadow">
            f
          </button>
        </Link>

        {/* LINE */}
        <Link
          href={`https://social-plugins.line.me/lineit/share?url=${url}`}
          target="_blank"
        >
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-green-500 text-white font-bold text-lg shadow">
            LINE
          </button>
        </Link>
      </div>

      <p>ここにホームのコンテンツが入ります。</p>
    </main>
  );
}
