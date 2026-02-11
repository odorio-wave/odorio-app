"use client";

import React from "react";

type Props = {
    // 数字のIDではなく、srcのURLをそのまま受け取るように変更
    src: string;
    width?: number | string;
    height?: number | string;
    style?: React.CSSProperties;
    className?: string;
};

export default function NinjaAdMax({ src, width = 300, height = 250, style, className }: Props) {
    // Iframeの中に流し込むHTMLを作成
    // margin:0 padding:0 で余白を消し、スクリプトを読み込ませる
    const htmlContent = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>body{margin:0;padding:0;overflow:hidden;background-color:transparent;}</style>
            </head>
            <body>
                <script src="${src}"></script>
            </body>
        </html>
    `;

    return (
        <iframe
            srcDoc={htmlContent}
            width={width}
            height={height}
            style={{ border: "none", overflow: "hidden", ...style }}
            className={className}
            scrolling="no"
            title="ad"
        />
    );
}