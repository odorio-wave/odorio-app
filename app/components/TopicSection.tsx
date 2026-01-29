'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Topic } from "../dynamic_topic";

const COLORS = {
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    BUTTON_SECONDARY: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    BUTTON_DISCUSSION: "bg-gray-800 hover:bg-gray-700 text-white",
    SHARE_X: "bg-black hover:bg-gray-800 text-white",
    SHARE_LINE: "bg-[#06C755] hover:bg-[#05b34c] text-white",
    CARD_BORDER: "border border-gray-200 rounded-lg p-3 shadow-sm",
    PERCENT_YES: "bg-blue-500",
    PERCENT_NO: "bg-purple-500",
    SHARE_OTHER: "bg-gray-600 hover:bg-gray-700 text-white",
};

type Props = {
    title: string;
    icon?: string;
    topics: Topic[];
    initialCount?: number; // 最初に見せる数
    emptyMessage?: string;
    isResultsVisible?: boolean; // デフォルトは false にするため optional
    onLike?: (id: string) => void;
    userId?: string | null;
};

// 表示用アイテムの型定義
type DisplayItem = {
    type: 'group' | 'single';
    data: Topic | Topic[];
};

export default function TopicSection({
    title, icon, topics, initialCount, emptyMessage, isResultsVisible,
    onLike, userId
}: Props) {

    const [copiedId, setCopiedId] = useState<string | null>(null);

    // グループ化されたお題ごとの「現在選択中のID」を管理するState
    const [selectedLogMap, setSelectedLogMap] = useState<Record<string, string>>({});

    // お題をグループ化する処理 (useMemo)
    const displayItems = useMemo(() => {
        const groups: Record<string, Topic[]> = {};
        const singles: Topic[] = [];
        const orderedKeys: string[] = []; // 表示順序を維持するためのキーリスト

        topics.forEach(t => {
            // 常設アーカイブ (archiveType='official') かつ 元IDがある場合
            const tAny = t as any;
            if (tAny.archiveType === 'official' && tAny.originalEndpointId) {
                const key = tAny.originalEndpointId;
                if (!groups[key]) {
                    groups[key] = [];
                    orderedKeys.push(key); // 初めて出てきた順序を記録
                }
                groups[key].push(t);
            } else {
                // それ以外（週替わりや単発）はそのまま
                singles.push(t);
                orderedKeys.push(t.topicId || t.id); // 順序記録
            }
        });

        // 元の並び順（日付順や人気順）をなるべく維持して再構築
        // ※単純化のため、今回は「グループ化されたものは代表(最新)の位置」に置く実装にします
        const result: DisplayItem[] = [];
        const processedKeys = new Set<string>();

        topics.forEach(t => {
            const tAny = t as any;
            const groupKey = (tAny.archiveType === 'official' && tAny.originalEndpointId)
                ? tAny.originalEndpointId
                : (t.topicId || t.id);

            if (processedKeys.has(groupKey)) return; // 処理済みならスキップ

            if (groups[groupKey]) {
                // グループの場合
                result.push({ type: 'group', data: groups[groupKey] });
                processedKeys.add(groupKey);
            } else {
                // シングルの場合
                result.push({ type: 'single', data: t });
                processedKeys.add(groupKey);
            }
        });

        return result;
    }, [topics]);

    // データがない場合
    if (topics.length === 0) {
        return (
            <section className="mb-10">
                <h2 className="text-xl font-black mb-4 text-gray-800 flex items-center gap-2">
                    <span className="text-2xl">{icon}</span> {title}
                </h2>
                <div className={`text-center py-10 bg-white text-gray-400 ${COLORS.CARD_BORDER}`}>
                    {emptyMessage}
                </div>
            </section>
        );
    }

    // シェア用URL生成ヘルパー
    const buildTopicUrl = (topicId: string) => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/topic/${topicId}`;
        }
        return '';
    };

    const handleNativeShare = async (topic: Topic, safeId: string) => {
        const shareUrl = buildTopicUrl(safeId);
        const shareData = {
            title: topic.title,
            text: topic.description || topic.title,
            url: shareUrl,
        };

        // Web Share API
        if (navigator.share && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                // キャンセル時は何もしない
            }
        }

        // クリップボードコピー
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedId(safeId); // IDをセット
            setTimeout(() => setCopiedId(null), 2000); // 2秒後にリセット
        } catch (err) {
            alert("URLのコピーに失敗しました");
        }
    };

    // ★共通のボタンスタイル（メインボタンとシェアボタンで統一）
    const commonButtonStyle = "py-1.5 px-3 rounded-md font-bold text-sm shadow-sm transition transform active:scale-95 flex items-center justify-center";

    return (
        <section className="mb-10">
            <h2 className="text-xl font-black mb-4 text-gray-800 flex items-center gap-2">
                <span className="text-2xl">{icon}</span> {title}
            </h2>

            {/* 2列レイアウト (md:grid-cols-2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayItems.slice(0, initialCount).map((item: DisplayItem, idx: number) => {
                    let currentTopic: Topic;
                    let versionList: Topic[] = [];
                    let isGroup = false;
                    if (item.type === 'group') {
                        isGroup = true;
                        versionList = item.data as Topic[];
                        // グループID (originalEndpointId)
                        const groupId = (versionList[0] as any).originalEndpointId;
                        // 現在選択されているIDを取得（なければ最新[0]を使う）
                        const selectedId = selectedLogMap[groupId] || versionList[0].topicId || versionList[0].id;
                        // 表示するトピックを決定
                        currentTopic = versionList.find(v => (v.topicId || v.id) === selectedId) || versionList[0];
                    } else {
                        currentTopic = item.data as Topic;
                    }

                    // ここからは currentTopic を使って描画
                    const topic = currentTopic;
                    // ID安全策
                    const safeId = topic.topicId || topic.id || "";
                    const t = topic as any;
                    const likes = t.archiveLikes || [];
                    const likeCount = likes.length;
                    const isLiked = userId && likes.includes(userId);

                    // 各カードごとにコピー状態を管理するState
                    const isCopied = copiedId === safeId;

                    // ボタンのロジック決定
                    let buttonText = "参加する";
                    let buttonBg = COLORS.BUTTON_PRIMARY;

                    if (isResultsVisible) {
                        // 議論・公開フェーズ（結果が見える時）
                        buttonText = "議論を見る";
                        buttonBg = COLORS.BUTTON_DISCUSSION;
                    } else if (topic.type === 'weekly' || !topic.type) {
                        // 投票フェーズ（週替わり）
                        buttonText = "投票する";
                        buttonBg = COLORS.BUTTON_PRIMARY;
                    } else {
                        // 常設など
                        buttonText = "参加する";
                        buttonBg = COLORS.BUTTON_PRIMARY;
                    }

                    return (
                        // カード本体：flex flex-col h-full で高さを揃える
                        <div key={safeId + idx} className={`bg-white hover:shadow-md transition flex flex-col h-full ${COLORS.CARD_BORDER}`}>

                            {/* コンテンツ部分 (flex-1 で余白を埋める) */}
                            <div className="flex-1 mb-4">
                                {/* グループの場合、日付選択プルダウンを表示 */}
                                {isGroup && (
                                    <div className="mb-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                        <label className="text-[10px] font-bold text-gray-500 block mb-1">📅 過去の開催回を選択</label>
                                        <select
                                            className="w-full text-xs font-bold p-1.5 border rounded bg-white"
                                            value={safeId}
                                            onChange={(e) => {
                                                const groupId = (t as any).originalEndpointId;
                                                setSelectedLogMap(prev => ({ ...prev, [groupId]: e.target.value }));
                                            }}
                                        >
                                            {versionList.map(v => (
                                                <option key={v.topicId || v.id} value={v.topicId || v.id}>
                                                    {new Date(v.endDate).toLocaleDateString()} 終了分
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{topic.title}</h3>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                        {topic.startDate ? new Date(topic.startDate).toLocaleDateString() : ""}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                                    {topic.description || "説明はありません"}
                                </p>

                                {/* 結果プレビュー */}
                                {isResultsVisible && topic.options && topic.options.length > 0 && (
                                    <div className="space-y-1">
                                        {topic.options.slice(0, 2).map((opt, i) => {
                                            const votes = t.votes?.[opt.id] || 0;
                                            const total = Object.values(t.votes || {}).reduce((a: any, b: any) => a + b, 0) as number;
                                            const percent = total > 0 ? Math.round((votes / total) * 100) : 0;

                                            return (
                                                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                                    <span className="w-8 text-right font-bold">{percent}%</span>
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${i === 0 ? COLORS.PERCENT_YES : COLORS.PERCENT_NO}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="truncate w-20">{opt.text}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-3 border-t border-gray-100">
                                <div className="flex justify-between items-center gap-2">

                                    {/* 1.メインボタン */}
                                    <Link href={`/topic/${safeId}`}>
                                        <button className={`${commonButtonStyle} ${buttonBg}`}>
                                            {buttonText}
                                        </button>
                                    </Link>

                                    {/* 2.シェアボタン & いいね */}
                                    <div className="flex items-center gap-2">
                                        {/* いいねボタン（onLikeがある場合＝アーカイブのみ表示） */}
                                        {onLike && (
                                            <button
                                                onClick={() => onLike(safeId)}
                                                className={`
                                                    px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200
                                                    ${isLiked
                                                        ? 'bg-pink-100 text-pink-500'
                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                    }
                                                `}
                                            >
                                                <span>{isLiked ? '❤️' : '🤍'}</span>
                                                <span>{likeCount}</span>
                                            </button>
                                        )}

                                        {/* シェアボタン */}
                                        {/* X共有ボタン (サイズ指定適用) */}
                                        <a href={`https://x.com/intent/tweet?url=${buildTopicUrl(safeId)}&text=${encodeURIComponent(topic.title)}`} target="_blank" rel="noreferrer">
                                            <button className={`${commonButtonStyle} ${COLORS.SHARE_X}`}>X</button>
                                        </a>

                                        {/* LINE共有ボタン (サイズ指定適用) */}
                                        <a href={`https://social-plugins.line.me/lineit/share?url=${buildTopicUrl(safeId)}`} target="_blank" rel="noreferrer">
                                            <button className={`${commonButtonStyle} ${COLORS.SHARE_LINE}`}>LINE</button>
                                        </a>

                                        {/* その他のシェアボタンを追加 */}
                                        <button
                                            onClick={() => handleNativeShare(topic, safeId)}
                                            className={`${commonButtonStyle} ${COLORS.SHARE_OTHER}`}
                                        >
                                            {isCopied ? 'Copied!' : '共有'}
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section >
    );
}