'use client';

import React, { useState, useMemo } from 'react';
import TopicCard from "./TopicCard";

type Props = {
    title: string;
    icon?: string;
    topics: any[];
    initialCount?: number;
    emptyMessage?: string;
    isResultsVisible?: boolean;
    onLike?: (id: string) => void;
    userId?: string | null;
};

// 表示用アイテムの型定義
type DisplayItem =
    | { type: 'single'; data: any }
    | { type: 'group'; data: any[] };

export default function TopicSection({
    title, icon, topics, initialCount, emptyMessage, isResultsVisible = false,
    onLike, userId
}: Props) {

    // 1. State定義
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedLogMap, setSelectedLogMap] = useState<Record<string, string>>({});

    // 2. グループ化処理 (useMemo)
    const displayItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const singles: any[] = [];

        topics.forEach(t => {
            if (t.archiveType === 'official' && t.originalEndpointId) {
                const key = t.originalEndpointId;
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            } else {
                singles.push(t);
            }
        });

        const result: DisplayItem[] = [];
        const processedKeys = new Set<string>();

        topics.forEach((t: any) => {
            const groupKey = (t.archiveType === 'official' && t.originalEndpointId)
                ? t.originalEndpointId
                : t.id;

            if (processedKeys.has(groupKey)) return;

            if (groups[groupKey]) {
                // 日付順ソート（新しい順）
                groups[groupKey].sort((a, b) => {
                    const dateA = new Date(a.startDate || 0).getTime();
                    const dateB = new Date(b.startDate || 0).getTime();
                    return dateB - dateA;
                });
                result.push({ type: 'group', data: groups[groupKey] });
                processedKeys.add(groupKey);
            } else {
                result.push({ type: 'single', data: t });
                processedKeys.add(groupKey);
            }
        });

        return result;
    }, [topics]);

    // 3. データがない場合の表示
    if (topics.length === 0) {
        return (
            <section className="mb-10 px-4">
                <h2 className="text-xl md:text-2xl font-black mb-4 text-gray-800 flex items-center gap-2">
                    {icon && <span>{icon}</span>} {title}
                </h2>
                <div className="text-center py-10 bg-white text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    {emptyMessage}
                </div>
            </section>
        );
    }

    // 4. 表示数の計算
    const count = initialCount ?? 2;
    const visibleItems = isExpanded ? displayItems : displayItems.slice(0, count);
    const showButton = displayItems.length > count;

    return (
        <section className="mb-10 px-4">
            <h2 className="text-xl md:text-2xl font-black mb-4 text-gray-800 flex items-center gap-2">
                {icon && <span>{icon}</span>} {title}
            </h2>

            {/* リスト表示: md以上で2列グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleItems.map((item) => {

                    // --- A. グループ表示の場合 ---
                    if (item.type === 'group') {
                        const groupKey = item.data[0].originalEndpointId;
                        const currentId = selectedLogMap[groupKey] || item.data[0].id;
                        // 選択されたトピック、なければ最新
                        const currentTopic = item.data.find((t: any) => t.id === currentId) || item.data[0];

                        return (
                            <div key={groupKey} className="flex flex-col h-full">
                                {/* TopicCardに全ての表示責任を委譲 */}
                                <TopicCard
                                    topic={currentTopic}
                                    isResultsVisible={!!isResultsVisible}
                                    onLike={onLike}
                                    userId={userId}
                                    // グループ情報（プルダウン用）を渡す
                                    groupVersions={item.data}
                                    onVersionSelect={(id) => setSelectedLogMap(prev => ({ ...prev, [groupKey]: id }))}
                                />
                            </div>
                        );
                    }

                    // --- B. シングル表示の場合 ---
                    else {
                        return (
                            <div key={item.data.id} className="flex flex-col h-full">
                                <TopicCard
                                    topic={item.data}
                                    isResultsVisible={!!isResultsVisible}
                                    onLike={onLike}
                                    userId={userId}
                                />
                            </div>
                        );
                    }
                })}
            </div>

            {/* もっと見るボタン */}
            {showButton && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-sm font-bold text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-600 px-6 py-2 rounded-full transition-all duration-200"
                    >
                        {isExpanded ? "▲ 閉じる" : `▼ もっと見る（全${displayItems.length}件）`}
                    </button>
                </div>
            )}
        </section>
    );
}