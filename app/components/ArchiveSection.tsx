"use client";

import React, { useState, useMemo } from "react";
import { Topic } from "../dynamic_topic";
import TopicSection from "./TopicSection";

// カラー定義
const COLORS = {
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    BUTTON_SECONDARY: "bg-gray-200 hover:bg-gray-300 text-gray-800",
};

type Props = {
    initialArchives: Topic[]; // 親から渡される「未加工のアーカイブ」
    userId: string | null;
    onLike: (topicId: string) => void;
};

export default function ArchiveSection({ initialArchives, userId, onLike }: Props) {
    // --- State (このセクション専用の状態) ---
    const [sortArchiveBy, setSortArchiveBy] = useState<"date" | "popularity">("date");
    const [filterArchiveType, setFilterArchiveType] = useState<"all" | "weekly" | "official">("all");
    const [showAllHistory, setShowAllHistory] = useState(false); // 全履歴表示スイッチ

    // --- Logic (並び替え・重複除外) ---
    const sortedArchive = useMemo(() => {
        // 1. フィルタリング
        let filtered = initialArchives;

        if (filterArchiveType !== 'all') {
            filtered = initialArchives.filter(t => {
                const type = (t as any).archiveType;
                if (type) return type === filterArchiveType;

                const isLikelyOfficial = t.title.includes("(過去ログ)");
                if (filterArchiveType === 'official') return isLikelyOfficial;
                if (filterArchiveType === 'weekly') return !isLikelyOfficial;
                return true;
            });
        }

        // 2. 重複除外処理 (スイッチで挙動を変える)
        let targetList: Topic[] = [];

        if (showAllHistory) {
            // ★スイッチON: 全ての履歴を表示 (重複除外しない)
            targetList = [...filtered];
        } else {
            // ★スイッチOFF: 最新版のみ選出
            const latestVersionMap = new Map<string, Topic>();
            const otherArchives: Topic[] = [];

            filtered.forEach(topic => {
                const originalId = (topic as any).originalEndpointId;
                if (originalId) {
                    const existing = latestVersionMap.get(originalId);
                    if (!existing) {
                        latestVersionMap.set(originalId, topic);
                    } else {
                        const dateExisting = existing.endDate ? new Date(existing.endDate).getTime() : 0;
                        const dateNew = topic.endDate ? new Date(topic.endDate).getTime() : 0;
                        if (dateNew > dateExisting) {
                            latestVersionMap.set(originalId, topic);
                        }
                    }
                } else {
                    otherArchives.push(topic);
                }
            });
            targetList = [...otherArchives, ...Array.from(latestVersionMap.values())];
        }

        // 3. 最終的なソート処理
        return targetList.sort((a, b) => {
            if (sortArchiveBy === "popularity") {
                const likesA = (a as any).archiveLikes?.length || 0;
                const likesB = (b as any).archiveLikes?.length || 0;
                if (likesA === likesB) {
                    const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
                    const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
                    return dateB - dateA;
                }
                return likesB - likesA;
            }

            // 日付順 (デフォルト)
            const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
            const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
            return dateB - dateA;
        });

    }, [initialArchives, sortArchiveBy, filterArchiveType, showAllHistory]);

    return (
        <section className="pb-10">
            {/* ツールバーエリア */}
            <div className="flex flex-wrap justify-between items-end mb-4 gap-2">

                {/* フィルタ切り替えタブ */}
                <div className="flex bg-gray-200 p-1 rounded-lg">
                    <button
                        onClick={() => setFilterArchiveType("all")}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterArchiveType === "all" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        すべて
                    </button>
                    <button
                        onClick={() => setFilterArchiveType("official")}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterArchiveType === "official" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        常設
                    </button>
                    <button
                        onClick={() => setFilterArchiveType("weekly")}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterArchiveType === "weekly" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        週替わり
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* 全履歴表示スイッチ */}
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={showAllHistory}
                            onChange={(e) => setShowAllHistory(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-700">過去ログも全て表示</span>
                    </label>

                    {/* ソートボタン */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSortArchiveBy("date")}
                            className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "date" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}
                        >
                            日付順
                        </button>
                        <button
                            onClick={() => setSortArchiveBy("popularity")}
                            className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "popularity" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}
                        >
                            人気順
                        </button>
                    </div>
                </div>
            </div>

            {/* 一覧表示 */}
            <TopicSection
                title="📦 アーカイブ"
                topics={sortedArchive}
                initialCount={4}
                emptyMessage="アーカイブはありません"
                isResultsVisible={true}
                onLike={onLike}
                userId={userId}
            />
        </section>
    );
}