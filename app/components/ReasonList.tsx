'use client';

import { useState } from 'react';

// 型定義（簡易版）
type Reason = {
    id: string;
    text: string;
    senderName?: string;
    optionId?: string; // どっちの選択肢への理由か
    likes?: string[];  // いいねした人のIDリスト
    createdAt?: string;
};

type Props = {
    reasons: Reason[];
    options: { id: string; text: string; color?: string }[];
    isDiscussionPhase: boolean; // 議論フェーズかどうか
    userId: string | null;
    onVote: (reasonId: string) => void; // いいねボタンを押した時の処理
};

export default function ReasonList({ reasons, options, isDiscussionPhase, userId, onVote }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    // --- 共通のカード部品 ---
    const ReasonCard = ({ r, rank }: { r: Reason, rank: number }) => {
        const likeCount = (r.likes || []).length;
        const isLiked = userId && (r.likes || []).includes(userId);
        const isTop3 = rank <= 3; // 1~3位なら強調

        // 上位3件は特別感のあるデザイン（金色の枠など）
        const containerStyle = isTop3
            ? "border-2 border-yellow-400 bg-yellow-50 shadow-md transform scale-[1.01]"
            : "border border-gray-200 bg-white";

        const badge = isTop3 ? (
            <span className="absolute -top-3 -left-2 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                👑 第{rank}位
            </span>
        ) : null;

        return (
            <div className={`relative p-3 rounded-xl mb-3 transition-all ${containerStyle}`}>
                {badge}
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.text}</p>
                        <div className="text-[10px] text-gray-400 mt-1">
                            {r.senderName || "名無し"}
                        </div>
                    </div>
                    <button
                        onClick={() => onVote(r.id)}
                        className={`flex flex-col items-center min-w-[40px] p-1 rounded-lg transition ${isLiked ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}
                    >
                        <span className="text-lg">♥</span>
                        <span className="text-xs font-bold">{likeCount}</span>
                    </button>
                </div>
            </div>
        );
    };

    // --- 並び替えロジック ---
    // ハートが多い順 -> 新着順
    const sortReasons = (list: Reason[]) => {
        return [...list].sort((a, b) => {
            const countA = (a.likes || []).length;
            const countB = (b.likes || []).length;
            if (countA !== countB) return countB - countA; // ハート順
            // ハートが同じなら新しい順
            return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
        });
    };

    // 表示ロジックの分岐

    // ■ パターンA：議論フェーズ（左右に分ける）
    if (isDiscussionPhase) {
        // 選択肢ごとにグループ分け
        const groupedReasons = options.map(opt => {
            const list = sortReasons(reasons.filter(r => r.optionId === opt.id));
            return { option: opt, list };
        });

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedReasons.map((group) => {
                        // 上位3件 + 残り
                        const displayList = isExpanded ? group.list : group.list.slice(0, 3);
                        const hiddenCount = group.list.length - 3;

                        return (
                            <div key={group.option.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                                <h3 className={`font-bold text-center mb-4 pb-2 border-b text-${group.option.color || 'gray'}-600`}>
                                    {group.option.text} 派の主張
                                </h3>
                                {displayList.length > 0 ? (
                                    displayList.map((r, idx) => <ReasonCard key={r.id} r={r} rank={idx + 1} />)
                                ) : (
                                    <p className="text-center text-xs text-gray-400 py-4">まだ投稿がありません</p>
                                )}

                                {/* 陣営ごとの「もっと見る」は複雑になるので、全体で制御するか、あるいは表示のみ */}
                                {!isExpanded && hiddenCount > 0 && (
                                    <div className="text-center text-xs text-gray-400 mt-2">
                                        他 {hiddenCount} 件の意見があります
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 開閉ボタン (全体コントロール) */}
                {(groupedReasons.some(g => g.list.length > 3)) && (
                    <div className="text-center">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="bg-gray-800 text-white text-xs font-bold py-2 px-6 rounded-full hover:bg-gray-700 transition"
                        >
                            {isExpanded ? '折りたたむ' : 'すべての意見を読む'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ■ パターンB：通常フェーズ（混ぜてランキング）
    const sortedAll = sortReasons(reasons);
    const displayAll = isExpanded ? sortedAll : sortedAll.slice(0, 3);
    const hiddenCountAll = sortedAll.length - 3;

    return (
        <div>
            <div className="space-y-2">
                {displayAll.length > 0 ? (
                    displayAll.map((r, idx) => <ReasonCard key={r.id} r={r} rank={idx + 1} />)
                ) : (
                    <p className="text-center text-gray-400 text-sm py-4">まだ投稿がありません。一番乗りで投稿しよう！</p>
                )}
            </div>

            {!isExpanded && hiddenCountAll > 0 && (
                <div className="mt-4 text-center">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="text-blue-600 font-bold text-sm hover:underline"
                    >
                        ▼ もっと見る (残り{hiddenCountAll}件)
                    </button>
                </div>
            )}
            {isExpanded && hiddenCountAll > 0 && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-gray-500 font-bold text-sm hover:underline"
                    >
                        ▲ 折りたたむ
                    </button>
                </div>
            )}
        </div>
    );
}