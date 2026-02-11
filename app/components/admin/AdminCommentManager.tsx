"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, limit, getDoc } from "firebase/firestore";

// お題リスト用の方定義を拡張
type TopicSummary = {
  id: string;
  title: string;
  type: string;   // official | weekly | archive
  status: string; // published | archived | pending
  startDate: string;
};

type TopicDetail = {
  options: { id: string; text: string }[];
};

type CommentData = {
  id: string;
  text: string;
  userId: string;
  timestamp: any;
  reports?: number;
  voteOptionId?: string;
  userVoteChoice?: string;
  phase?: string;
};

export default function AdminCommentManager() {
  // --- State ---
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicFilter, setTopicFilter] = useState<"all" | "official" | "weekly" | "archive">("all"); // ★お題フィルタ
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"comments" | "reasons">("comments");
  const [filterMode, setFilterMode] = useState<string>("all"); // コメント絞り込み

  const [items, setItems] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. お題の一覧を取得（件数を少し多めに100件取得）
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const q = query(collection(db, "topics"), orderBy("startDate", "desc"), limit(100));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => {
          const data = d.data();

          // 日付の変換処理 (Firestore Timestamp か 文字列 かに対応)
          let dateStr = "";
          if (data.startDate) {
            const dateObj = typeof data.startDate.toDate === 'function'
              ? data.startDate.toDate()
              : new Date(data.startDate);
            dateStr = dateObj.toLocaleDateString(); // "2026/2/7" のような形式に
          }

          return {
            id: d.id,
            title: data.title,
            type: data.type || 'weekly',
            status: data.status || 'published',
            startDate: dateStr // ここで日付を保存
          };
        });
        setTopics(list);
      } catch (e) {
        console.error("お題取得エラー:", e);
      }
    };
    fetchTopics();
  }, []);

  // ★お題リストのフィルタリング処理
  const filteredTopics = useMemo(() => {
    return topics.filter(t => {
      if (topicFilter === 'all') return true;

      // アーカイブ: typeがarchive または statusがarchived
      if (topicFilter === 'archive') {
        return t.type === 'archive' || t.status === 'archived';
      }

      // 常設: typeがofficial かつ アーカイブではない
      if (topicFilter === 'official') {
        return t.type === 'official' && t.status !== 'archived';
      }

      // 週替わり: typeがweekly (または指定なし) かつ アーカイブではない
      if (topicFilter === 'weekly') {
        return (t.type === 'weekly' || !t.type) && t.status !== 'archived';
      }

      return true;
    });
  }, [topics, topicFilter]);


  // 2. お題詳細取得
  useEffect(() => {
    if (!selectedTopicId) {
      setTopicDetail(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        const snap = await getDoc(doc(db, "topics", selectedTopicId));
        if (snap.exists()) {
          const data = snap.data();
          setTopicDetail({ options: data.options || [] });
        }
      } catch (e) { console.error(e); }
    };
    fetchDetail();
    setFilterMode("all");
  }, [selectedTopicId]);

  // 3. コメント取得
  useEffect(() => {
    if (!selectedTopicId) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        const subCollection = activeTab === "comments" ? "comments" : "reasons";
        const q = query(collection(db, "topics", selectedTopicId, subCollection), orderBy("timestamp", "desc"), limit(300));

        const snap = await getDocs(q);
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            text: data.text,
            userId: data.userId,
            timestamp: data.timestamp,
            reports: data.reports || 0,
            voteOptionId: data.voteOptionId,
            userVoteChoice: data.userVoteChoice,
            phase: data.phase
          };
        });
        setItems(list);
      } catch (e) {
        console.error(e);
        alert("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [selectedTopicId, activeTab]);

  // 4. コメントフィルタリング
  const filteredItems = useMemo(() => {
    if (filterMode === "all") return items;
    return items.filter(item => {
      if (filterMode === "discussion") return item.phase === "discussion";
      const targetChoice = activeTab === "reasons" ? item.voteOptionId : item.userVoteChoice;
      return targetChoice === filterMode;
    });
  }, [items, filterMode, activeTab]);

  // 5. 削除処理
  const handleDelete = async (itemId: string) => {
    if (!confirm("本当にこの投稿を削除しますか？")) return;
    try {
      const subCollection = activeTab === "comments" ? "comments" : "reasons";
      await deleteDoc(doc(db, "topics", selectedTopicId, subCollection, itemId));
      setItems(prev => prev.filter(i => i.id !== itemId));
      alert("削除しました");
    } catch (e) {
      alert("削除に失敗しました");
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    if (typeof ts === 'string') return new Date(ts).toLocaleString();
    if (ts.toDate) return ts.toDate().toLocaleString();
    return "-";
  };

  const getOptionName = (optId?: string) => {
    if (!optId || !topicDetail) return "不明";
    const opt = topicDetail.options.find(o => o.id === optId);
    return opt ? opt.text : "不明";
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border-2 border-gray-200">
      <h2 className="text-xl font-black mb-4 text-gray-800 flex items-center gap-2">
        💬 コメント・理由の管理
      </h2>

      {/* A. お題選択エリア */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block text-xs font-bold text-gray-500 mb-2">① お題の種類で絞り込み</label>

        {/* ★ここに追加：お題フィルタボタン */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setTopicFilter("all")}
            className={`px-3 py-1 text-xs font-bold rounded border ${topicFilter === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600"}`}
          >
            すべて
          </button>
          <button
            onClick={() => setTopicFilter("weekly")}
            className={`px-3 py-1 text-xs font-bold rounded border ${topicFilter === "weekly" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600"}`}
          >
            📅 週替わり
          </button>
          <button
            onClick={() => setTopicFilter("official")}
            className={`px-3 py-1 text-xs font-bold rounded border ${topicFilter === "official" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}
          >
            🏢 常設
          </button>
          <button
            onClick={() => setTopicFilter("archive")}
            className={`px-3 py-1 text-xs font-bold rounded border ${topicFilter === "archive" ? "bg-gray-500 text-white border-gray-500" : "bg-white text-gray-600"}`}
          >
            📦 アーカイブ
          </button>
        </div>

        <label className="block text-xs font-bold text-gray-500 mb-2">② 管理するお題を選択</label>
        <select
          className="w-full p-2 border rounded bg-white font-bold text-gray-700"
          value={selectedTopicId}
          onChange={(e) => setSelectedTopicId(e.target.value)}
        >
          <option value="">-- お題を選択してください --</option>
          {filteredTopics.map(t => (
            <option key={t.id} value={t.id}>
              {t.startDate ? `[${t.startDate}] ` : ''}
              {t.type === 'official' ? '【常設】' : t.status === 'archived' ? '【済】' : ''}
              {t.title}
            </option>
          ))}
        </select>
        <p className="text-right text-xs text-gray-400 mt-1">{filteredTopics.length} 件のお題が見つかりました</p>
      </div>

      {/* 以下、選択後の中身（以前と同じ） */}
      {selectedTopicId && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-end border-b pb-2 mb-4 gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveTab("comments"); setFilterMode("all"); }}
                className={`px-4 py-2 font-bold transition ${activeTab === "comments" ? "bg-blue-100 text-blue-700 rounded-t-lg border-b-2 border-blue-500" : "text-gray-500 hover:bg-gray-50"}`}
              >
                掲示板コメント
              </button>
              <button
                onClick={() => { setActiveTab("reasons"); setFilterMode("all"); }}
                className={`px-4 py-2 font-bold transition ${activeTab === "reasons" ? "bg-blue-100 text-blue-700 rounded-t-lg border-b-2 border-blue-500" : "text-gray-500 hover:bg-gray-50"}`}
              >
                投票の理由
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">絞り込み:</span>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="border p-1 rounded font-bold text-sm bg-gray-50"
              >
                <option value="all">すべて表示</option>
                {activeTab === "comments" && (
                  <option value="discussion">🗣️ 議論掲示板のみ</option>
                )}
                {topicDetail?.options.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.text} 派
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500 animate-pulse">データを読み込んでいます...</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto border p-2 rounded bg-gray-50">
              <p className="text-right text-xs text-gray-400 mb-2">
                表示中: {filteredItems.length}件 / 全取得: {items.length}件
              </p>

              {filteredItems.length === 0 && <p className="text-gray-400 p-10 text-center">該当する投稿がありません</p>}

              {filteredItems.map(item => (
                <div key={item.id} className="bg-white p-3 border rounded shadow-sm flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-1">
                      {(item.reports || 0) > 0 && (
                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">
                          ⚠️ 通報: {item.reports}
                        </span>
                      )}

                      {activeTab === "reasons" && item.voteOptionId && (
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                          {getOptionName(item.voteOptionId)} 派
                        </span>
                      )}
                      {activeTab === "comments" && item.userVoteChoice && (
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                          {getOptionName(item.userVoteChoice)} 派
                        </span>
                      )}

                      {activeTab === "comments" && item.phase === "discussion" && (
                        <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded border border-green-100">
                          🗣️ 議論
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.text}</p>

                    <div className="text-xs text-gray-400 mt-1 flex gap-3">
                      <span>{formatDate(item.timestamp)}</span>
                      <span>ID: {item.userId.slice(0, 6)}...</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 bg-white text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold border border-red-200 transition"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}