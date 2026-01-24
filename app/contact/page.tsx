"use client";
import React, { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ここに送信処理 (FirebaseやメールAPI) を実装予定
    alert("お問い合わせありがとうございます。\n現在はデモ版のため送信されませんが、機能実装をお待ちください。");
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-2xl p-8 bg-white shadow-md my-8 rounded-xl">
        <a href="/">
          <button className="mb-6 text-sm text-blue-600 hover:underline">← ホームに戻る</button>
        </a>

        <h1 className="text-2xl font-bold mb-6 text-gray-800">お問い合わせ</h1>
        <p className="mb-6 text-gray-600 text-sm">
          サイトに関するご意見・ご要望、不具合の報告、広告掲載に関するお問い合わせはこちらからお願いいたします。
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">お名前 (必須)</label>
            <input
              required
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="山田 太郎"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス (必須)</label>
            <input
              required
              type="email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="example@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">お問い合わせ内容 (必須)</label>
            <textarea
              required
              rows={5}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="詳細をご記入ください..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition transform hover:scale-[1.01]"
          >
            送信する
          </button>
        </form>
      </div>
    </div>
  );
}