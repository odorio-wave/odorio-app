"use client";
import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-3xl p-6 bg-white shadow-sm my-8 rounded-xl">
        <a href="/">
          <button className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-bold text-gray-700 transition">
            ← ホームに戻る
          </button>
        </a>

        <h1 className="text-3xl font-bold mb-8 border-b pb-4 text-gray-900">プライバシーポリシー</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">1. 個人情報の取得について</h2>
            <p>
              当サイト「ODORIO（オドリオ）」では、以下の方法でユーザー情報を取得する場合があります。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1 bg-gray-50 p-4 rounded-lg">
              <li>お問い合わせフォームの送信（名前、メールアドレス等）</li>
              <li>コメントや投票機能の利用（IPアドレス、ブラウザ情報等）</li>
              <li>ログイン機能の利用（Googleアカウント等の認証情報、ユーザーID）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">2. 個人情報の利用目的</h2>
            <p>
              取得した情報は、以下の目的で利用いたします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>本サービスの提供・運営のため（二重投票の防止、ログイン状態の維持など）</li>
              <li>お問い合わせへの対応のため</li>
              <li>不正・スパム行為の防止のため</li>
              <li>利用規約に違反したユーザーの特定、対応のため</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">3. Firebaseの利用について</h2>
            <p>
              当サイトでは、サービスの認証・データベース管理・ホスティング等のために、Google社が提供する「Firebase」を利用しています。
              これに伴い、ユーザーのログ情報やデバイス情報等がGoogleのサーバーに送信・保存される場合があります。
              Firebaseのデータ処理に関する詳細は<a href="https://firebase.google.com/terms/data-processing-terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">「Google Cloud Data Processing Terms」</a>をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">4. 広告について</h2>
            <p>
              当サイトでは、第三者配信の広告サービス（Googleアドセンス等）を利用しており、ユーザーの興味に応じた商品やサービスの広告を表示するため、クッキー（Cookie）を使用しております。
              クッキーを使用することで当サイトはお客様のコンピュータを識別できるようになりますが、お客様個人を特定できるものではありません。
            </p>
            <p className="mt-2">
              Cookieを無効にする方法やGoogleアドセンスに関する詳細は<a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">「広告 – ポリシーと規約 – Google」</a>をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">5. アクセス解析ツールについて</h2>
            <p>
              当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにクッキー（Cookie）を使用しております。トラフィックデータは匿名で収集されており、個人を特定するものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">6. 投稿データの公開について</h2>
            <p>
              当サイトの投票理由や掲示板に投稿されたコメントは、不特定多数のユーザーが閲覧可能な状態で公開されます。
              投稿内に、個人を特定できる情報（本名、住所、電話番号など）を書き込まないようご注意ください。
              自ら公開した情報により発生したトラブルについて、当サイトは一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">7. 免責事項</h2>
            <p>
              当サイトからのリンクやバナーなどで移動したサイトで提供される情報、サービス等について一切の責任を負いません。
              また当サイトのコンテンツ・情報について、できる限り正確な情報を提供するように努めておりますが、正確性や安全性を保証するものではありません。
              当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-green-500 pl-2">8. お問い合わせ</h2>
            <p>
              本ポリシーに関するお問い合わせや、個人情報の削除依頼、その他ご質問については、以下のお問い合わせフォームよりご連絡ください。
            </p>
            <div className="mt-6 text-center">
              <a
                href="https://odorio-app.vercel.app/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition transform hover:-translate-y-1"
              >
                お問い合わせフォームへ
              </a>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
          <p>制定日：2026年1月1日</p>
          <p>最終改定日：{new Date().toLocaleDateString()}</p>
          <p className="mt-2">運営：ODORIO 運営委員会（開発者: ボッチ）</p>
        </div>
      </div>
    </div>
  );
}