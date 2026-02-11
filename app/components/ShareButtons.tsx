'use client';

import React, { useState, useEffect } from "react";

type Props = {
    title: string;
    options?: { text: string }[]; // 追加: 選択肢
    topicId?: string;             // 追加: URL生成用のお題ID
};

export default function ShareButtons({ title, options, topicId }: Props) {
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);

    // マウント後に表示するようにする（Hydrationエラー防止）
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="h-10 animate-pulse bg-gray-200 rounded-lg w-full max-w-xs" />;
    }

    // シェアするテキストを作成
    // mapとjoinを使って、選択肢が3つ以上でも「A 🆚 B 🆚 C...」と繋がるように修正
    const shareText = (options && options.length >= 1)
        ? `${title}\n\n` + options.map(o => o.text).join(" 🆚 ") + `\n投票に参加しよう!`
        : `${title}\n投票に参加しよう!`;

    // リンク先URL（表示用）
    const currentUrl = typeof window !== "undefined"
        ? (topicId ? `${window.location.origin}/topic/${topicId}` : window.location.href)
        : "";

    // エンコード（URLやテキストをリンク用に変換）
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedText = encodeURIComponent(shareText + " #ODORIO");

    // --- 以下、stateのurlを使います ---
    const handleNativeShare = async () => {
        // 現在のURLを確実に取得
        const shareData = {
            title: title,
            text: shareText + " #ODORIO",
            url: currentUrl,
        };

        // 1. スマホなど Web Share API が使える場合 (かつ HTTPS であること)
        // ※ navigator.canShare で「本当にシェアできるか」を事前チェックするとなお確実です
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('シェアがキャンセルされました', error);
            }
        }
        // 2. PCや、非対応ブラウザ(http環境含む)の場合はコピー
        else {
            try {
                await navigator.clipboard.writeText(currentUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                alert('コピーに失敗しました');
            }
        }
    };

    const btnBase = "w-24 h-10 rounded-lg text-xs font-bold flex items-center justify-center transition shadow-sm";

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
                className={`${btnBase} bg-gray-200 text-gray-700 hover:bg-gray-300 gap-1`}
            >
                <span className="text-sm">
                    📤
                </span>
                共有
            </button>
        </div>
    );
}