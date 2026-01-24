"use client";
import React from "react";

export default function Operator() {
  // シェア用URLとタイトル
  const shareUrl = "https://odorio.jp";
  const shareTitle = "ODORIO - 運営者情報";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-2xl p-8 bg-white shadow-md my-8 rounded-xl text-center">
        <a href="/">
          <button className="mb-8 text-sm text-blue-600 hover:underline">← ホームに戻る</button>
        </a>
        
        <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
            🤔
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900">ODORIO 運営委員会（ボッチ）</h1>
        <p className="text-gray-500 mb-6">Philosophy & Discussion Platform</p>
        
        <div className="text-left bg-gray-50 p-6 rounded-lg border border-gray-100 mb-8">
            <h3 className="font-bold text-gray-800 mb-2">サイトの理念</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
                日常に隠れている「正解のない問題」について、多様な価値観を可視化し、互いの考えを尊重しながら議論できる場を作りたいという思いで「ODORIO（オドリオ）」を開発しました。
            </p>
            <h3 className="font-bold text-gray-800 mb-2">開発者について</h3>
            <p className="text-gray-600 leading-relaxed">
                そこら辺にいる大学生です。このサイトは Next.js とモダンなWeb技術を使用して構築されています。
                機能追加の要望やバグ報告は、お問い合わせフォームまたはSNSまでお寄せください。
            </p>
        </div>

        <div className="flex justify-center gap-2">
            <a
              href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-md transition"
            >
              <span className="mr-1">𝕏</span> Post
            </a>
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-4 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white text-sm font-bold rounded-md transition"
            >
              LINEで送る
            </a>
        </div>
      </div>
    </div>
  );
}