"use client";
import React from "react";
import Link from "next/link";

export default function Guide() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* --- ヒーローセクション --- */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-block p-3 bg-blue-100 rounded-full mb-4 text-4xl">💃</div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            「ODORIO」へようこそ
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            正解のない哲学的な問題について、直感で投票し、論理で語り合う。<br />
            議論が踊り、価値観が交差する。<br />
            世の中の「曖昧」を楽しむための投票プラットフォームです。
          </p>
          <div className="mt-8">
            <Link href="/">
              <button className="px-8 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-1">
                議論に参加する
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- コンセプト --- */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="md:w-1/2">
              <h2 className="text-2xl font-bold mb-4 text-blue-900 flex items-center gap-2">
                <span className="text-3xl">💡</span>
                ODORIO（オドリオ）とは？
              </h2>
              <p className="text-gray-600 leading-relaxed">
                「トロッコ問題」や「朝型・夜型」のように、世の中には明確な正解がない問いがたくさんあります。<br />
                ここでは<strong>「まずは直感で投票」</strong>し、その後に<strong>「理由を言語化」</strong>することで、自分と他者の価値観の違いを可視化します。
              </p>
            </div>
            <div className="md:w-1/2 flex justify-center">
              {/* ロゴプレースホルダー */}
              <div className="md:w-1/2 flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-lg border-4 border-white bg-white">
                  <img
                    src="/favicon.ico"
                    alt="ODORIO ロゴ"
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 3つのステップ --- */}
      <section className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">遊び方はシンプルです</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 text-3xl">
                🙈
              </div>
              <h3 className="text-xl font-bold mb-2">1. 直感で投票</h3>
              <p className="text-sm text-gray-600">
                まずは自分の考えに近い選択肢に投票しましょう。<br />
                <strong>「戦場の霧」システム</strong>により、投票期間中はどちらが優勢かは分かりません。先入観なしで選んでください。
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 text-3xl">
                💬
              </div>
              <h3 className="text-xl font-bold mb-2">2. 理由を投稿</h3>
              <p className="text-sm text-gray-600">
                なぜその選択肢を選んだのか、理由をひと言で投稿しましょう。<br />
                他の人の理由は、投票が終わるまで（または公開フェーズまで）伏せられることもあります。
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 text-3xl">
                👥
              </div>
              <h3 className="text-xl font-bold mb-2">3. 議論と発見</h3>
              <p className="text-sm text-gray-600">
                週末になると<strong>「議論フェーズ」</strong>が解禁。<br />
                全員のコメントが見られるようになり、掲示板で意見交換ができます。意外な視点が見つかるかもしれません。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- スケジュール --- */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8 flex items-center justify-center gap-2">
            <span className="text-3xl">📊</span>
            1週間のサイクル
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-left">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded shrink-0 w-24 text-center">月〜火</div>
                <div>
                  <h4 className="font-bold">🗳️ 投票フェーズ</h4>
                  <p className="text-sm text-gray-600">新しいお題が公開されます。結果は伏せられています。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 text-yellow-800 font-bold px-3 py-1 rounded shrink-0 w-24 text-center">水</div>
                <div>
                  <h4 className="font-bold">📊 結果公開フェーズ</h4>
                  <p className="text-sm text-gray-600">投票の途中経過（％）が誰でも見られるようになります。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-gray-200 text-gray-800 font-bold px-3 py-1 rounded shrink-0 w-24 text-center">木</div>
                <div>
                  <h4 className="font-bold">🔒 非公開フェーズ</h4>
                  <p className="text-sm text-gray-600">議論の直前、結果が再び隠されます（ブラックアウト）。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded shrink-0 w-24 text-center">金〜日</div>
                <div>
                  <h4 className="font-bold">🗣️ 議論フェーズ</h4>
                  <p className="text-sm text-gray-600">掲示板がフルオープンになり、全陣営のコメントが見られます。</p>
                </div>
              </div>
            </div>
            <div className="mt-6 text-xs text-gray-400 text-center">
              ※ 月曜日の朝9:00にお題が切り替わります。
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-20 px-6 bg-blue-600 text-white text-center">
        <h2 className="text-3xl font-bold mb-6">さあ、あなたの答えを探しに行こう。</h2>
        <p className="mb-8 text-blue-100">
          登録不要で、すぐに参加できます。<br />
          あなたが追加してほしいお題も募集中です。
        </p>
        <Link href="/">
          <button className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full shadow-lg hover:bg-gray-100 transition">
            ホームに戻る
          </button>
        </Link>
      </section>

      {/* --- フッター --- */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <div className="flex justify-center gap-4 mb-4">
          <Link href="/contact" className="hover:underline">お問い合わせ</Link>
          <Link href="/terms" className="hover:underline">利用規約</Link>
          <Link href="/privacy" className="hover:underline">プライバシー</Link>
          <Link href="/operator" className="hover:underline">運営者情報</Link>
        </div>
        &copy; {new Date().getFullYear()} ODORIO
      </footer>
    </div>
  );
}