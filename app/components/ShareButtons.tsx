'use client';

import React, { useState, useEffect } from "react";

type Props = {
    title: string;
    options?: { text: string }[]; // 追加: 選択肢
    topicId?: string;             // 追加: URL生成用のお題ID
};

export default function ShareButtons({ title, options, topicId }: Props) {
    // URLをStateで管理
    const [url, setUrl] = useState("");
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // 1. URLの取得
        const baseUrl = window.location.origin;

        // topicIdがある場合(投票ページ)は個別URLを、なければトップページURLを設定
        if (topicId) {
            setUrl(`${baseUrl}/topic/${topicId}`);
        } else {
            setUrl(baseUrl);
        }

        // 2. スマホ判定
        if (typeof navigator !== 'undefined') {
            setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
        }
    }, [topicId]);

    // シェアするテキストを作成
    // mapとjoinを使って、選択肢が3つ以上でも「A 🆚 B 🆚 C...」と繋がるように修正
    const shareText = (options && options.length >= 1)
        ? `${title}\n\n` + options.map(o => o.text).join(" 🆚 ") + `\n`
        : `${title}\n`;

    // エンコード（URLやテキストをリンク用に変換）
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareText + "#ODORIO");

    // ★重要: URLがまだ無い（サーバー側レンダリング中など）場合はスペースだけ確保
    if (!url) {
        return <div className="h-10 animate-pulse bg-gray-200 rounded-lg w-full max-w-xs" />;
    }

    // --- 以下、stateのurlを使います ---
    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: shareText + ' #ODORIO',
                    url: url,
                });
            } catch (error) {
                console.log('Share canceled', error);
            }
        } else {
            alert('URLをコピーしました！');
            navigator.clipboard.writeText(url);
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