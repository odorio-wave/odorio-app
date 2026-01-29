'use client';

import Link from "next/link";
import { Topic, TopicVoteResult } from "../dynamic_topic";

// カラー定義
const COLORS = {
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    SHARE_X: "bg-black hover:bg-gray-800 text-white",
    SHARE_LINE: "bg-[#06C755] hover:bg-[#05b34c] text-white",
    CARD_BORDER: "border border-gray-200 rounded-lg p-3 shadow-sm bg-white",
};

const OPTION_BG_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];

// ヘルパー関数: 投票結果の計算 (このファイル内で定義して完結させる)
function calculateTopicVotes(t: Topic): TopicVoteResult {
    const topicData = t as any;
    const votes = topicData.votes || {};
    const total = Object.values(votes).reduce((sum: number, count: any) => sum + (count as number), 0) as number;

    const optionsResult = (t.options || []).map((opt: any) => {
        const count = votes[opt.id] || 0;
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        return {
            id: opt.id,
            text: opt.text,
            count: count,
            percentage: percentage
        };
    });

    const yesVotes = optionsResult[0]?.count || 0;
    const noVotes = optionsResult[1]?.count || 0;
    const yesPct = optionsResult[0]?.percentage || 0;
    const noPct = optionsResult[1]?.percentage || 0;

    return {
        yes: yesVotes,
        no: noVotes,
        yesPercentage: yesPct,
        noPercentage: noPct,
        totalVotes: total,
        options: optionsResult
    };
}

type Props = {
    topic: Topic;
    isResultsVisible: boolean; // 結果を表示するかどうかのフラグ
};

export default function TopicCard({ topic, isResultsVisible }: Props) {
    // 内部関数を使って計算
    const result = calculateTopicVotes(topic);
    const voteOptions = result?.options || [];

    // フェーズ判定（日付判定のみ）
    const now = new Date();
    const endDate = new Date(topic.endDate);
    const isEnded = now > endDate;

    // URL生成
    const shareUrl = typeof window !== "undefined"
        ? `${window.location.origin}/topic/${topic.topicId || topic.id}`
        : "";

    return (
        <article className={COLORS.CARD_BORDER}>
            <h4 className="text-lg font-semibold mb-1 text-gray-800">{topic.title}</h4>
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{topic.description}</p>

            {/* 投票結果バー */}
            {isResultsVisible && voteOptions.length > 0 ? (
                <div className="mb-3 animate-in fade-in">
                    <div className="flex h-2 rounded overflow-hidden bg-gray-100">
                        {voteOptions.map((opt: any, index: number) => (
                            <div
                                key={opt.id}
                                style={{ width: `${opt.percentage}%` }}
                                className={OPTION_BG_COLORS[index % 5]}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        {voteOptions.map((opt: any) => (
                            <span key={opt.id}>{opt.text} {opt.percentage}%</span>
                        ))}
                    </div>
                </div>
            ) : (
                /* 結果非表示の時は、スペース確保またはメッセージ */
                <div className="mb-3 p-2 bg-gray-50 border border-dashed border-gray-200 rounded text-center">
                    <span className="text-[10px] text-gray-400 font-bold">集計中 / 結果非表示</span>
                </div>
            )}

            <div className="flex justify-between items-center gap-2 mt-2">
                <Link href={`/topic/${topic.topicId || topic.id}`} className="flex-1">
                    <button className={`w-full py-1.5 px-3 rounded-md border-none text-sm font-bold ${isEnded ? 'bg-gray-600 text-white' : COLORS.BUTTON_PRIMARY}`}>
                        {isEnded ? '結果を見る' : '参加する'}
                    </button>
                </Link>

                <div className="flex gap-1.5">
                    <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(topic.title)}`} target="_blank" rel="noreferrer">
                        <button className={`${COLORS.SHARE_X} text-xs py-1.5 px-2 rounded`}>X</button>
                    </a>
                    <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                        <button className={`${COLORS.SHARE_LINE} text-xs py-1.5 px-2 rounded`}>LINE</button>
                    </a>
                </div>
            </div>
        </article>
    );
}