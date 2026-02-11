"use client";
import React from "react";

export default function TermsOfService() {
  return (
    <div className="flex justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-3xl p-6 bg-white shadow-sm my-8 rounded-xl">
        <a href="/">
          <button className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-bold text-gray-700 transition">
            ← ホームに戻る
          </button>
        </a>

        <h1 className="text-3xl font-bold mb-8 border-b pb-4 text-gray-900">利用規約</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
          <p>
            この利用規約（以下，「本規約」といいます。）は，「ODORIO（オドリオ）」（以下，「当サイト」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。利用者の皆さま（以下，「ユーザー」といいます。）には，本規約に従って，本サービスをご利用いただきます。
          </p>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第1条（適用）</h2>
            <p>本規約は，ユーザーと当サイトとの間の本サービスの利用に関わる一切の関係に適用されるものとします。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第2条（禁止事項）</h2>
            <p className="mb-2">ユーザーは，本サービスの利用にあたり，以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside ml-2 space-y-2 bg-gray-50 p-4 rounded-lg">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サイトのサーバーまたはネットワークの機能を破壊したり，妨害したりする行為</li>
              <li>当サイトのサービスの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>当サイトのサービスに関連して，反社会的勢力に対して直接または間接に利益を供与する行為</li>
              {/* ★ここから炎上対策・差別対策の強化項目 */}
              <li>特定の人種、信条、性別、社会的身分、門地等に対する差別的言動や、ヘイトスピーチにあたる投稿</li>
              <li>お題や他者の投稿の意図を故意に曲解し、攻撃的な文脈で拡散する行為</li>
              <li>過度に暴力的、残虐、わいせつな表現を含む投稿</li>
              <li>宗教活動または宗教団体への勧誘行為、政治活動</li>
              <li>その他，当サイトが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第3条（本サービスの提供の停止等）</h2>
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
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第4条（利用制限および投稿の削除）</h2>
            <p>
              当サイトは，ユーザーが本規約のいずれかの条項に違反した場合，または当サイトが不適切と判断した場合、事前の通知なく以下の措置をとることができるものとします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>投稿データ（コメント、お題リクエスト等）の削除</li>
              <li>本サービスの全部または一部の利用制限</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">
              ※当サイトは、本条に基づき当サイトが行った行為によりユーザーに生じた損害について、一切の責任を負いません。
            </p>
          </section>

          {/* ★新規追加: 投稿データの権利について */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第5条（投稿データの権利確認）</h2>
            <p>
              ユーザーが本サービスに投稿したコメントやお題等の著作権はユーザーに帰属しますが、当サイトはこれらを本サービスの円滑な提供、改良、宣伝広告等のために、無償かつ非独占的に使用（複製、公開、送信、頒布、譲渡、貸与、翻訳、翻案等）できるものとします。ユーザーはこの利用に関して著作者人格権を行使しないものとします。
            </p>
          </section>

          {/* ★最重要: 炎上対策のための免責強化 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第6条（免責事項）</h2>
            <div className="space-y-3">
              <p>
                当サイトに掲載されるお題やコンテンツは、エンターテインメントや思考実験を目的としたものであり、特定の思想、信条、差別的意図を推奨または表明するものではありません。
              </p>
              <p>
                当サイトは、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
              </p>
              <p>
                当サイトは、本サービスの内容の正確性、妥当性、道徳性について保証するものではありません。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第7条（利用規約の変更）</h2>
            <p>
              当サイトは，必要と判断した場合には，ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお，本規約の変更後，本サービスの利用を開始した場合には，当該ユーザーは変更後の規約に同意したものとみなします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-900 border-l-4 border-blue-500 pl-2">第8条（準拠法・裁判管轄）</h2>
            <p>
              本規約の解釈にあたっては，日本法を準拠法とします。本サービスに関して紛争が生じた場合には，当サイト運営者の所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}