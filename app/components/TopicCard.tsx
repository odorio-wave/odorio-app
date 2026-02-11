'use client';

import React, { useState } from 'react';
import Link from "next/link";

// カラー定義
const COLORS = {
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    BUTTON_DISCUSSION: "bg-gray-800 hover:bg-gray-700 text-white",
    SHARE_X: "bg-black hover:bg-gray-800 text-white",
    SHARE_LINE: "bg-[#06C755] hover:bg-[#05b34c] text-white",
    SHARE_OTHER: "bg-gray-600 hover:bg-gray-700 text-white",
    CARD_BORDER: "border border-gray-200 rounded-lg p-3 shadow-sm bg-white",
    PERCENT_YES: "bg-blue-500",
    PERCENT_NO: "bg-purple-500",
};

const OPTION_BG_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];

// 日付フォーマット関数 (YYYY/MM/DD)
const formatDate = (d: any) => {
    if (!d) return "";
    // FirestoreのTimestamp型とDate型両方に対応
    const date = typeof d.toDate === 'function' ? d.toDate() : new Date(d);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

type Props = {
    topic: any; // Topic型
    isResultsVisible: boolean;
    onLike?: (id: string) => void;
    userId?: string | null;
    groupVersions?: any[];
    onVersionSelect?: (id: string) => void;
};

export default function TopicCard({
    topic,
    isResultsVisible,
    onLike,
    userId,
    groupVersions,
    onVersionSelect
}: Props) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // IDとステータスの安全な取得
    const safeId = topic.topicId || topic.id || "";
    const likes = topic.archiveLikes || [];
    const likeCount = likes.length;
    const isLiked = userId && likes.includes(userId);
    const isCopied = copiedId === safeId;

    // 1. アーカイブかどうか
    const isArchived = topic.type === 'archive' || topic.status === 'archived';

    // 2. 自分が投票したかどうか
    const hasVoted = userId && (topic.votedUserIds || []).includes(userId);

    // 3. 最終的にグラフを表示するかどうか
    const shouldShowStats = isResultsVisible && (hasVoted || isArchived);

    // URL生成
    const buildTopicUrl = (id: string) => {
        if (typeof window !== "undefined") {
            return `${window.location.origin}/topic/${id}`;
        }
        return "";
    };

    // ネイティブシェア & コピー機能
    const handleNativeShare = async () => {
        const shareUrl = buildTopicUrl(safeId);
        const shareData = {
            title: topic.title,
            text: topic.description || topic.title,
            url: shareUrl,
        };

        if (navigator.share && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) { return; }
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedId(safeId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            alert("URLのコピーに失敗しました");
        }
    };

    // ボタンの見た目決定ロジック
    let buttonText = "参加する";
    let buttonBg = COLORS.BUTTON_PRIMARY;

    if (isResultsVisible) {
        buttonText = "議論を見る";
        buttonBg = COLORS.BUTTON_DISCUSSION;
    } else if (topic.type === 'weekly' || !topic.type) {
        buttonText = "投票する";
        buttonBg = COLORS.BUTTON_PRIMARY;
    }

    return (
        <article className={`flex flex-col h-full ${COLORS.CARD_BORDER}`}>

            {/* コンテンツ部分 (高さを揃えるためにflex-1) */}
            <div className="flex-1 mb-4">

                {/* 1. ▼▼▼ グループ選択プルダウン ▼▼▼ */}
                {groupVersions && groupVersions.length > 1 && onVersionSelect && (
                    <div className="mb-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">📅 過去の開催回を選択</label>
                        <select
                            className="w-full text-xs font-bold p-1.5 border rounded bg-white text-gray-700 cursor-pointer hover:bg-gray-50"
                            value={safeId}
                            onChange={(e) => onVersionSelect(e.target.value)}
                        >
                            {groupVersions.map((v: any) => {
                                // その回の総投票数を計算
                                const vTotal = v.votes
                                    ? Object.values(v.votes).reduce((a: any, b: any) => a + b, 0) as number
                                    : 0;

                                return (
                                    <option key={v.topicId || v.id} value={v.topicId || v.id}>
                                        {formatDate(v.startDate)}〜 ({vTotal}票)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* 2. タイトルと日付 */}
                <div className="flex justify-between items-start mb-1">
                    <h4 className="text-lg font-semibold text-gray-800 line-clamp-2">{topic.title}</h4>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 pt-1">
                        {formatDate(topic.startDate)}
                    </span>
                </div>

                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{topic.description}</p>

                {/* 3. 投票結果バー (結果表示モードの時のみ) */}
                {shouldShowStats && topic.options && topic.options.length > 0 ? (
                    <div className="mb-3 animate-in fade-in">
                        {(() => {
                            const total = Object.values(topic.votes || {}).reduce((a: any, b: any) => a + b, 0) as number;
                            return (
                                <>
                                    <div className="flex h-2 rounded overflow-hidden bg-gray-100 mb-1">
                                        {topic.options.map((opt: any, index: number) => {
                                            const count = topic.votes?.[opt.id] || 0;
                                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                            if (pct === 0) return null;
                                            return (
                                                <div
                                                    key={opt.id}
                                                    style={{ width: `${pct}%` }}
                                                    className={OPTION_BG_COLORS[index % 5]}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <div className="flex gap-2 overflow-hidden">
                                            {topic.options.slice(0, 2).map((opt: any) => {
                                                const count = topic.votes?.[opt.id] || 0;
                                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                                return <span key={opt.id} className="truncate">{opt.text}: {pct}%</span>;
                                            })}
                                        </div>
                                        <span className="shrink-0 ml-1">
                                            計{total}票
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : (
                    /* 条件を満たしていない場合の表示 */
                    <>
                        {isResultsVisible && !shouldShowStats && (
                            <div className="mb-3 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
                                <p className="text-xs font-bold text-gray-600 mb-1">
                                    🔒 結果は非表示です
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    投票に参加すると<br />みんなの回答が見られます
                                </p>
                            </div>
                        )}
                        {isResultsVisible && !topic.options && (
                            <div className="mb-3 p-2 bg-gray-50 border border-dashed border-gray-200 rounded text-center">
                                <span className="text-[10px] text-gray-400 font-bold">
                                    集計中 / 結果なし
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 4. フッター（アクションエリア） */}
            <div className="mt-auto pt-2 border-t border-gray-100 flex justify-between items-center gap-2">

                {/* メインボタン */}
                <Link href={`/topic/${safeId}`} className="flex-1">
                    <button className={`w-full py-1.5 px-3 rounded-md text-sm font-bold shadow-sm transition-transform active:scale-95 ${buttonBg}`}>
                        {buttonText}
                    </button>
                </Link>

                {/* アイコンボタン群 */}
                <div className="flex gap-1.5">

                    {/* いいねボタン（アーカイブ用） */}
                    {onLike && (
                        <button
                            onClick={() => onLike(safeId)}
                            className={`px-2 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition ${isLiked ? 'bg-pink-100 text-pink-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                        >
                            <span>{isLiked ? '❤️' : '🤍'}</span>
                            <span>{likeCount}</span>
                        </button>
                    )}

                    {/* Xシェア */}
                    <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(buildTopicUrl(safeId))}&text=${encodeURIComponent(topic.title)}`} target="_blank" rel="noreferrer">
                        <button className={`${COLORS.SHARE_X} text-xs py-1.5 px-2 rounded font-bold`}>X</button>
                    </a>

                    {/* LINEシェア */}
                    <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(buildTopicUrl(safeId))}`} target="_blank" rel="noreferrer">
                        <button className={`${COLORS.SHARE_LINE} text-xs py-1.5 px-2 rounded font-bold`}>LINE</button>
                    </a>

                    {/* コピーボタン */}
                    <button
                        onClick={handleNativeShare}
                        className={`${COLORS.SHARE_OTHER} text-xs py-1.5 px-2 rounded font-bold min-w-[50px]`}
                    >
                        {isCopied ? 'OK' : '共有'}
                    </button>
                </div>
            </div>
        </article>
    );
}