"use client";

import React, { useState } from "react";
// import Image from "next/image";

export default function Operator() {
  // シェア用URLとタイトル
  const shareUrl = "https://odorio-mzkmc0ii9-rms-projects-440f8710.vercel.app/";
  const shareTitle = "ODORIO - 投票×議論";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle + "\n");

  // コピー完了のステート
  const [isCopied, setIsCopied] = useState(false);

  // ネイティブシェア & コピー機能
  const handleNativeShare = async () => {
    const shareData = {
      title: shareTitle,
      text: shareTitle,
      url: shareUrl,
    };

    // 1. スマホなどで「共有メニュー」が使えるならそれを使う
    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // キャンセルされた場合などは何もしない
        return;
      }
    }

    // 2. 使えない場合（PCなど）はクリップボードにコピー
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      alert("コピーに失敗しました");
    }
  };

  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-2xl p-8 bg-white shadow-md my-8 rounded-xl text-center">
        <a href="/">
          <button className="mb-8 text-sm text-blue-600 hover:underline">← ホームに戻る</button>
        </a>

        <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
          🤔
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-2 text-gray-900 whitespace-nowrap">
          ODORIO 運営委員会（ボッチ）
        </h1>
        <p className="text-gray-500 mb-6">Philosophy & Discussion Platform</p>

        <div className="text-left bg-gray-50 p-6 rounded-lg border border-gray-100 mb-8">
          <h3 className="font-bold text-gray-800 mb-2">サイトの理念</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            日常に隠れている「正解のない問題」について、多様な価値観を可視化し、互いの考えを尊重しながら議論できる場を作りたいという思いで「ODORIO（オドリオ）」を開発しました。
          </p>
          <h3 className="font-bold text-gray-800 mb-2">開発者について</h3>
          <p className="text-gray-600 leading-relaxed">
            そこら辺にいる一人暮らし大学生です。このサイトは Next.js とモダンなWeb技術を使用して構築されています。
            機能追加の要望やバグ報告は、お問い合わせフォームまたはSNSまでお寄せください。
          </p>
          <p className="text-gray-600 leading-relaxed text-sm md:text-base">
            サーバー代と少しばかり生活費をご支援いただけると、やる気しかなくなります。
          </p>
        </div>
        <div className="mb-10">
          <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">- SUPPORT ME -</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">

            {/* OFUSEボタン */}
            <a
              href="https://ofuse.me/4ef07035"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full shadow-md transition transform hover:-translate-y-1"
            >
              💌 OFUSEで応援
            </a>

            {/* Amazonほしい物リストボタン */}
            {/* <a
              href="https://www.amazon.jp/hz/wishlist/ls/..." // ★あなたのほしい物リストのURLに書き換えてください
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-full shadow-md transition transform hover:-translate-y-1"
            >
              🎁 ほしい物リスト
            </a> */}
          </div>
          <p className="text-xs text-gray-400 mt-2">※ いただいたご支援はサイト運営費に充てられます</p>
        </div>

        {/* シェアボタンエリア */}
        <div className="border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 mb-3">このサイトをシェア</p>
          <div className="flex justify-center gap-2">
            {/* X (Twitter) */}
            <a
              href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-md transition"
            >
              <span className="mr-1">𝕏</span> Post
            </a>
            {/* LINE */}
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-4 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white text-sm font-bold rounded-md transition"
            >
              LINEで送る
            </a>
            {/* 共有 / その他 (Web Share API) */}
            <button
              onClick={handleNativeShare}
              className={`flex items-center justify-center px-4 py-2 text-sm font-bold rounded-md transition min-w-[100px] border ${isCopied
                ? "bg-green-500 text-white border-green-500" // コピー完了時
                : "bg-gray-600 hover:bg-gray-700 text-white border-gray-600" // 通常時
                }`}
            >
              {isCopied ? "✅ OK" : "📤 共有"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}