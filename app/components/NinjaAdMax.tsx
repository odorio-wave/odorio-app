"use client";
import React, { useEffect, useRef } from "react";

// 忍者AdMaxのスクリプトURL
const SCRIPT_URL = "https://adm.shinobi.jp/st/t.js";

type Props = {
    admaxId: string; // 忍者AdMaxのID（数字の文字列）
};

export default function NinjaAdMax({ admaxId }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // コンポーネントが表示されたときにスクリプトを読み込む
        if (!containerRef.current) return;

        // すでにスクリプトがある場合は多重に追加しない
        if (containerRef.current.querySelector(`script[src="${SCRIPT_URL}"]`)) return;

        const script = document.createElement("script");
        script.src = SCRIPT_URL;
        script.async = true;
        script.charset = "utf-8";

        // 生成したスクリプトをDOMに追加して実行させる
        containerRef.current.appendChild(script);

    }, [admaxId]);

    return (
        <div
            className="flex justify-center my-8 bg-gray-50 min-h-[100px] items-center"
            ref={containerRef}
        >
            {/* 広告が表示される場所 */}
            <div
                className="admax-ads"
                data-admax-id={admaxId}
                style={{ display: "inline-block" }}
            />
        </div>
    );
}