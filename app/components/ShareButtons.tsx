"use client";
import React, { useState, useEffect } from 'react';

type Props = {
    url: string;
    title: string;
};

export default function ShareButtons({ url, title }: Props) {
    const [copied, setCopied] = useState(false);
    const [canShare, setCanShare] = useState(false);

    // マウント時に Web Share API が使えるかチェック
    useEffect(() => {
        // "&& navigator.share" だけだと警告が出るため、typeof で関数かどうかをチェックします
        if (typeof navigator.share === 'function') {
            setCanShare(true);
        }
    }, []);

    // 𝕏 (旧Twitter) シェア
    const handleXShare = () => {
        const text = `${title}\n#ODORIO #投票 #議論`;
        const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank');
    };

    // LINE シェア
    const handleLineShare = () => {
        const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
        window.open(shareUrl, '_blank');
    };

    // リンクコピー
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // 2秒後に戻す
        } catch (e) {
            console.error("コピーに失敗しました", e);
            alert("コピーに失敗しました。手動でコピーしてください。");
        }
    };

    // スマホの純正共有メニュー
    const handleNativeShare = async () => {
        try {
            await navigator.share({
                title: title,
                text: `${title} #ODORIO`,
                url: url,
            });
        } catch (e) {
            // キャンセルされた場合などは何もしない
            console.log("共有がキャンセルされました");
        }
    };

    return (
        <div className="flex gap-2 items-center">
            {/* ラベル (スマホでは狭いので非表示かアイコンにする手もありますが、一旦残します) */}
            <span className="hidden sm:inline text-xs font-bold text-gray-400 mr-1">シェア:</span>

            {/* 𝕏 Button */}
            <button
                onClick={handleXShare}
                className="bg-black text-white hover:bg-gray-800 transition px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1"
                title="Xに投稿"
            >
                𝕏
            </button>

            {/* LINE Button */}
            <button
                onClick={handleLineShare}
                className="bg-[#06C755] text-white hover:bg-[#05b34c] transition px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1"
                title="LINEで送る"
            >
                LINE
            </button>

            {/* Link Copy Button */}
            <button
                onClick={handleCopy}
                className={`transition px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 border ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                title="リンクをコピー"
            >
                {copied ? '✅' : '🔗'}
            </button>

            {/* Native Share Button (対応ブラウザのみ表示) */}
            {canShare && (
                <button
                    onClick={handleNativeShare}
                    className="bg-blue-500 text-white hover:bg-blue-600 transition px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1"
                    title="その他のアプリで共有"
                >
                    📤
                </button>
            )}
        </div>
    );
}