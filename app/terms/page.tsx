"use client";
import React from "react";

export default function TermsOfService() {
  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-3xl p-6 bg-white shadow-sm my-8 rounded-xl">
        <a href="/">
          <button className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-bold text-gray-700">
            ← ホームに戻る
          </button>
        </a>
        
        <h1 className="text-3xl font-bold mb-8 border-b pb-4 text-gray-900">利用規約</h1>
        
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            この利用規約（以下，「本規約」といいます。）は，「ODORIO（オドリオ）」（以下，「当サイト」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。利用者の皆さま（以下，「ユーザー」といいます。）には，本規約に従って，本サービスをご利用いただきます。
          </p>

          <section>
            <h2 className="text-lg font-bold mb-2 text-gray-800">第1条（適用）</h2>
            <p>本規約は，ユーザーと当サイトとの間の本サービスの利用に関わる一切の関係に適用されるものとします。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2 text-gray-800">第2条（禁止事項）</h2>
            <p>ユーザーは，本サービスの利用にあたり，以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サイトのサーバーまたはネットワークの機能を破壊したり，妨害したりする行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>当サイトのサービスに関連して，反社会的勢力に対して直接または間接に利益を供与する行為</li>
              <li>その他，当サイトが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2 text-gray-800">第3条（本サービスの提供の停止等）</h2>
            <p>
              当サイトは，以下のいずれかの事由があると判断した場合，ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
              <li>地震，落雷，火災，停電または天災などの不可抗力により，本サービスの提供が困難となった場合</li>
              <li>その他，当サイトが本サービスの提供が困難と判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2 text-gray-800">第4条（利用制限および登録抹消）</h2>
            <p>
              当サイトは，ユーザーが本規約のいずれかの条項に違反した場合，事前の通知なく，ユーザーに対して本サービスの利用を制限し，または投稿データを削除することができるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2 text-gray-800">第5条（免責事項）</h2>
            <p>
              当サイトは，本サービスに関して，ユーザーと他のユーザーまたは第三者との間において生じた取引，連絡または紛争等について一切責任を負いません。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}