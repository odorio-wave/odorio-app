"use client";
import React from "react";

export default function Login() {
  const handleLogin = (provider: string) => {
    alert(`${provider}ログイン機能は現在準備中です。正式リリースをお待ちください！`);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-xl text-center">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">ログイン / 新規登録</h1>
        <p className="text-sm text-gray-500 mb-8">アカウントを作成して、議論に参加しよう</p>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin("Google")}
            className="w-full py-3 border border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition"
          >
            <span className="font-bold text-gray-700">Googleで続行</span>
          </button>
          
          <button
            onClick={() => handleLogin("X (Twitter)")}
            className="w-full py-3 bg-black text-white rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition"
          >
            <span className="font-bold">X (Twitter)で続行</span>
          </button>
          
          <button
            onClick={() => handleLogin("LINE")}
            className="w-full py-3 bg-[#06C755] text-white rounded-lg flex items-center justify-center gap-2 hover:bg-[#05b34c] transition"
          >
            <span className="font-bold">LINEで続行</span>
          </button>
        </div>
        
        <div className="mt-8 text-xs text-gray-400">
            <a href="/terms" className="underline hover:text-gray-600">利用規約</a> と <a href="/privacy" className="underline hover:text-gray-600">プライバシーポリシー</a> に同意したことになります。
        </div>

        <div className="mt-6 pt-6 border-t">
             <a href="/">
                <button className="text-sm text-blue-600 hover:underline">ログインせずにホームへ戻る</button>
             </a>
        </div>
      </div>
    </div>
  );
}