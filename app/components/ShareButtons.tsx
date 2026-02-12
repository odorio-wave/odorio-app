'use client';

import React, { useState, useEffect } from "react";

type Props = {
    title: string;
    options?: { id: string; text: string }[]; // 型を修正
    topicId?: string;             // URL生成用のお題ID
    votes?: Record<string, number>; // 票数データ（なくても動きます）
    showStats?: boolean;            // 統計を表示するかどうかのフラグ
};

export default function ShareButtons({ title, options, topicId, votes, showStats = false }: Props) {
    const [url, setUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // 1. URLの取得
        const baseUrl = window.location.origin;
        if (topicId) {
            setUrl(`${baseUrl}/topic/${topicId}`);
        } else {
            setUrl(baseUrl);
        }
    }, [topicId]);

    // シェアするテキストを作成
    const generateShareText = () => {
        // 選択肢がない場合はタイトルのみ
        if (!options || options.length === 0) {
            return `${title}\n`;
        }

        let optionsText = "";

        // 1. 統計表示アリ (結果公開・議論・アーカイブ)
        if (votes && showStats) {
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

            optionsText = options.map(o => {
                const count = votes[o.id] || 0;
                // 0票の時は0%にする
                const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                return `${o.text}(${percent}%)`;
            }).join(" vs ");

            // 例:
            // キノコ vs タケノコ
            // きの(58%) vs たけ(42%)
            // (現在1200票)
            return `${title}\n${optionsText}\n(現在${totalVotes}票)`;
        }

        // 2. 通常時 (投票中・隠すフェーズ)
        // 「きのこ vs たけのこ」のようにシンプルに
        optionsText = options.map(o => o.text).join(" vs ");

        return `${title}\n${optionsText}`;
    };

    const shareText = generateShareText();

    // エンコード（URLやテキストをリンク用に変換）
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareText + "\n#ODORIO");

    // マウント前やURL生成前はローディング表示
    if (!mounted || !url) {
        return <div className="h-10 animate-pulse bg-gray-200 rounded-lg w-full max-w-xs" />;
    }

    // シェアボタンの処理
    const handleNativeShare = async () => {
        const shareData = {
            title: title,
            text: shareText + "\n#ODORIO",
            url: url,
        };

        // 1. スマホなど Web Share API が使える場合
        // (HTTPS環境かつ、ブラウザが対応している場合のみ動作)
        // ※ navigator.canShare で「本当にシェアできるか」を事前チェック
        if (navigator.share && (navigator.canShare ? navigator.canShare(shareData) : true)) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                // キャンセルされた場合は何もしない
                console.log('Share canceled', error);
            }
        }
        // 2. PCや、開発環境(http)の場合はクリップボードにコピー
        else {
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true); // コピー完了状態にする
                setTimeout(() => setCopied(false), 2000); // 2秒後に戻す
            } catch (err) {
                alert('コピーに失敗しました');
            }
        }
    };

    return (
        <div className="flex justify-center items-center gap-3">
            {/* X (Twitter) */}
            <a
                href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center bg-black hover:bg-gray-800 text-white text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2.5 rounded-full transition shadow-sm"
            >
                <span className="mr-1.5">
                    𝕏
                </span> Post
            </a>

            {/* LINE */}
            {/* LINEはURLを送るとOGP画像を自動展開してくれます */}
            <a
                href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center bg-[#06C755] hover:bg-[#05b34c] text-white text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2.5 rounded-full transition shadow-sm"
            >
                LINEで送る
            </a>

            {/* ネイティブ共有/コピー */}
            <button
                onClick={handleNativeShare}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm border
                    ${copied
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                    }`}
            >
                {copied ? (
                    <>✅ コピー完了</>
                ) : (
                    <span className="text-sm">
                        📤 共有・🔗 コピー
                    </span>
                )}
            </button>
        </div>
    );
}