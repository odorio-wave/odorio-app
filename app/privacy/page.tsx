"use client";
import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-3xl p-6 bg-white shadow-sm my-8 rounded-xl">
        <a href="/">
          <button className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-bold text-gray-700">
            ← ホームに戻る
          </button>
        </a>
        
        <h1 className="text-3xl font-bold mb-8 border-b pb-4 text-gray-900">プライバシーポリシー</h1>
        
        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-800">1. 個人情報の利用目的</h2>
            <p>
              当サイト「ODORIO（オドリオ）」では、お問い合わせや記事へのコメントの際、名前やメールアドレス等の個人情報を入力いただく場合がございます。
              取得した個人情報は、お問い合わせに対する回答や必要な情報を電子メールなどでご連絡する場合に利用させていただくものであり、これらの目的以外では利用いたしません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-800">2. 広告について</h2>
            <p>
              当サイトでは、第三者配信の広告サービス（Googleアドセンス等）を利用しており、ユーザーの興味に応じた商品やサービスの広告を表示するため、クッキー（Cookie）を使用しております。
              クッキーを使用することで当サイトはお客様のコンピュータを識別できるようになりますが、お客様個人を特定できるものではありません。
            </p>
            <p className="mt-2">
              Cookieを無効にする方法やGoogleアドセンスに関する詳細は<a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">「広告 – ポリシーと規約 – Google」</a>をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-800">3. アクセス解析ツールについて</h2>
            <p>
              当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにクッキー（Cookie）を使用しております。トラフィックデータは匿名で収集されており、個人を特定するものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-800">4. 免責事項</h2>
            <p>
              当サイトからのリンクやバナーなどで移動したサイトで提供される情報、サービス等について一切の責任を負いません。
              また当サイトのコンテンツ・情報について、できる限り正確な情報を提供するように努めておりますが、正確性や安全性を保証するものではありません。情報が古くなっていることもございます。
              当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
          <p>制定日：{new Date().toLocaleDateString()}</p>
          <p>運営：ODORIO 運営委員会（ボッチ）</p>
        </div>
      </div>
    </div>
  );
}