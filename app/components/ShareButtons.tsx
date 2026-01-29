'use client';

import { useState, useEffect } from 'react';

type Props = {
    url: string;
    title: string;
};

export default function ShareButtons({ url, title }: Props) {
    const [isMobile, setIsMobile] = useState(false);

    // スマホかどうかを判定
    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
        }
    }, []);

    // シェア用URL作成
    const xUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;

    // 「その他」ボタン（Web Share API）
    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: title + ' #ODORIO',
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
        <div className="flex gap-2">
            {/* X (Twitter) */}
            <a href={xUrl} target="_blank" rel="noreferrer">
                <button className={`${btnBase} bg-black text-white hover:bg-gray-800`}>
                    X
                </button>
            </a>

            {/* LINE */}
            <a href={lineUrl} target="_blank" rel="noreferrer">
                <button className={`${btnBase} bg-[#06C755] text-white hover:bg-[#05b34c]`}>
                    LINE
                </button>
            </a>

            {/* ネイティブ共有（スマホ、または対応ブラウザのみ表示） */}
            <button
                onClick={handleNativeShare}
                className={`${btnBase} bg-gray-200 text-gray-700 hover:bg-gray-300 gap-1`}
            >
                <span className="text-sm">📤</span> 共有
            </button>
        </div>
    );
}