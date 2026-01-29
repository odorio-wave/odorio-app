"use client";
import React, { useState } from "react";
import Link from "next/link"; // Next.jsのリンク機能

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false); // 送信中の状態
  const [isSubmitted, setIsSubmitted] = useState(false);   // 送信完了の状態

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // ▼▼▼ APIへの送信処理 ▼▼▼
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // 送信成功
        setIsSubmitted(true);
        setFormData({ name: "", email: "", message: "" });
      } else {
        // 送信失敗
        alert("送信に失敗しました。もう一度お試しください。");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-2xl p-8 bg-white shadow-md my-8 rounded-xl border border-gray-100">
        <Link href="/">
          <button className="mb-6 text-sm text-blue-600 hover:underline">← ホームに戻る</button>
        </Link>

        {isSubmitted ? (
          // ▼▼▼ 送信完了画面 ▼▼▼
          <div className="text-center py-16 animate-fade-in">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">送信いたしました</h2>
            <p className="text-gray-600 mb-8">
              お問い合わせありがとうございます。<br />
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="text-blue-600 font-bold hover:underline"
            >
              お問い合わせフォームに戻る
            </button>
          </div>
        ) : (
          // ▼▼▼ 入力フォーム画面 ▼▼▼
          <>
            <h1 className="text-2xl font-bold mb-6 text-gray-800">お問い合わせ</h1>
            <p className="mb-6 text-gray-600 text-sm leading-relaxed">
              サイトに関するご意見・ご要望、不具合の報告、広告掲載に関するお問い合わせはこちらからお願いいたします。
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  お名前 <span className="text-red-500 text-xs">(必須)</span>
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition outline-none"
                  placeholder="山田 太郎"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500 text-xs">(必須)</span>
                </label>
                <input
                  required
                  type="email"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition outline-none"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  お問い合わせ内容 <span className="text-red-500 text-xs">(必須)</span>
                </label>
                <textarea
                  required
                  rows={5}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition outline-none"
                  placeholder="詳細をご記入ください..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting} // 送信中はボタンを押せないようにする
                className={`w-full py-3 text-white font-bold rounded-lg shadow-md transition transform 
                  ${isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 hover:scale-[1.01]"
                  }`}
              >
                {isSubmitting ? "送信中..." : "送信する"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}