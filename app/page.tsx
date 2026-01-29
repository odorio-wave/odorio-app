"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Topic,
  Proposal,
  ProposalOption
} from "./dynamic_topic"; // 型定義のインポート
import ShareButtons from "./components/ShareButtons";
import Toast from "./components/Toast";
import TopicSection from './components/TopicSection';
import NinjaAdMax from "@/app/components/NinjaAdMax";

// ★ Firebase Imports
import { db } from "./lib/firebase";
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot, query,
  arrayUnion, arrayRemove, writeBatch
} from "firebase/firestore";

// --- カラー定義
const COLORS = {
  BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
  BUTTON_SECONDARY: "bg-gray-200 hover:bg-gray-300 text-gray-800",
};

// 定数
const MAX_TITLE_LENGTH = 40;
const MAX_DESC_LENGTH = 200;

// 日付ユーティリティ
const parseDate = (s: string) => new Date(s);

// フェーズ決定ロジック
function computePhase(now: Date, overrideMode: string | null) {
  if (overrideMode) {
    const mode = overrideMode.trim().toLowerCase();
    if (mode === "voting") return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
    if (mode === "public") return { key: "public", label: "📊 結果公開フェーズ", color: "#f59e0b" };
    if (mode === "blackout") return { key: "blackout", label: "🔒 非公開フェーズ (議論準備)", color: "#6b7280" };
    if (mode === "discussion") return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
  }
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 1) {
    if (hour < 9) return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
    return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
  }
  if (day === 2) return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
  if (day === 3) return { key: "public", label: "📊 結果公開フェーズ", color: "#f59e0b" };
  if (day === 4) return { key: "blackout", label: "🔒 非公開フェーズ (議論準備)", color: "#6b7280" };
  return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
}

// 自動アーカイブ処理
function useCheckAndArchive(initialTopics: Topic[], now: Date, onUpdate: () => void) {
  useEffect(() => {
    if (!initialTopics || initialTopics.length === 0) return;
    const nowTime = now.getTime();
    initialTopics.forEach(async (t) => {
      // 終了時間を過ぎているかチェック
      const endDate = parseDate(t.endDate).getTime();
      if (nowTime <= endDate) return; // まだ終了していないなら何もしない
      if (t.status !== 'published') return; // 公開中以外は何もしない
      if (t.type === 'archive') return; // 既にアーカイブなら何もしない

      // 週替わりお題の場合
      if (t.type === 'weekly' || !t.type) {
        try {
          if (t.topicId) {
            await updateDoc(doc(db, "topics", t.topicId), {
              type: 'archive',
              status: 'archived',
              archiveType: 'weekly' // 週替わりとして記録
            });
            onUpdate();
          }
        } catch (e) { console.error(e); }
      }

      // 常設お題の場合
      else if (t.type === 'official') {
        try {
          // 1. アーカイブ用データ（過去ログ）の作成
          // 元のデータをコピーして、別のIDで保存します
          const archiveId = `${t.id}_${Math.floor(Date.now() / 1000)}`;
          const archiveData = {
            ...t,
            id: archiveId,
            topicId: archiveId,
            type: 'archive',          // アーカイブデータは type='archive'
            status: 'archived',       // ステータスはアーカイブ
            originalEndpointId: t.id, // 元のIDを紐付け
            title: `${t.title} (過去ログ)`,
            archiveType: 'official',  // アーカイブ種別を「常設」にする
            votes: (t as any).votes || {},
            archiveLikes: []
          };

          // 新しいドキュメントとして保存
          await setDoc(doc(db, "topics", archiveId), archiveData);

          // 2. 元の常設お題（本体）のリセット
          // ★重要: ここで type: 'official' を明示して、週替わり化を防ぐ
          const nextEndDate = new Date();
          nextEndDate.setDate(nextEndDate.getDate() + 7); // 次の期間をセット(例:7日後)

          await updateDoc(doc(db, "topics", t.topicId || t.id), {
            startDate: new Date().toISOString(),
            endDate: nextEndDate.toISOString(),
            votes: {},         // 票をリセット
            type: 'official'   // これがないと週替わりになってしまいます
          });

          onUpdate();
        } catch (e) { console.error(e); }
      }
    });
  }, [initialTopics, now, onUpdate]);
}

export default function Home() {
  const [now, setNow] = useState<Date>(new Date());
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [phaseMode, setPhaseMode] = useState(null);

  // フォーム状態
  const [proposalInput, setProposalInput] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([
    { prefix: "1.", text: "" },
    { prefix: "2.", text: "" },
  ]);

  // UI状態
  const [sortArchiveBy, setSortArchiveBy] = useState<"date" | "popularity">("date");
  const [filterArchiveType, setFilterArchiveType] = useState<"all" | "weekly" | "official">("all");
  const [proposalSortBy, setProposalSortBy] = useState<"votes" | "date">("votes");
  const [isMounted, setIsMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [proposalPage, setProposalPage] = useState(1);
  const PROPOSALS_PER_PAGE = 10;

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  const toggleArchiveLike = async (topicId: string) => {
    if (!userId) return;

    // allTopicsから対象を探す
    const target = allTopics.find(t => t.id === topicId || t.topicId === topicId);
    if (!target) return;

    // トピックID（ドキュメントID）を特定
    const docId = target.topicId || target.id;
    const currentLikes = (target as any).archiveLikes || [];
    const isLiked = currentLikes.includes(userId);
    const ref = doc(db, "topics", docId);

    try {
      if (isLiked) {
        // いいね解除
        await updateDoc(ref, { archiveLikes: arrayRemove(userId) });
      } else {
        // いいね登録
        await updateDoc(ref, { archiveLikes: arrayUnion(userId) });
        showToast("アーカイブに「いいね」しました！", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("エラーが発生しました", "error");
    }
  };

  // データ取得
  useEffect(() => {
    setIsMounted(true);
    let storedUid = localStorage.getItem("site_userid_v1");
    if (!storedUid) {
      storedUid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("site_userid_v1", storedUid);
    }
    setUserId(storedUid);

    const unsubTopics = onSnapshot(query(collection(db, "topics")), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Topic));
      setAllTopics(list);
    });

    const unsubProposals = onSnapshot(query(collection(db, "proposals")), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Proposal));
      setProposals(list);
    });

    const unsubConfig = onSnapshot(doc(db, "system", "config"), (docSnap) => {
      if (docSnap.exists()) {
        setPhaseMode(docSnap.data().phaseMode || null);
      }
    });

    const timerId = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      unsubTopics();
      unsubProposals();
      unsubConfig();
      clearInterval(timerId);
    };
  }, []);

  useCheckAndArchive(allTopics, now, () => { });

  // --- Functions (Vote, Proposal) ---
  const voteProposal = async (proposalId: string) => {
    if (!userId) return;
    const target = proposals.find(p => p.id === proposalId);
    if (!target) return;
    const voterIds = (target as any).voterIds || [];
    const isVoted = voterIds.includes(userId);
    const ref = doc(db, "proposals", proposalId);
    try {
      if (isVoted) {
        await updateDoc(ref, { voterIds: arrayRemove(userId), votes: (target.votes || 1) - 1 });
      } else {
        await updateDoc(ref, { voterIds: arrayUnion(userId), votes: (target.votes || 0) + 1 });
      }
    } catch (e) { showToast("エラーが発生しました", "error"); }
  };

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalInput.trim()) return showToast("タイトルを入力してください", "error");
    const validOptions = proposalOptions.filter(opt => opt.text.trim());
    if (validOptions.length < 2) return showToast("選択肢は最低2つ必要です", "error");

    const newId = `p_${Date.now()}`;
    const newProposal = {
      id: newId,
      title: proposalInput.trim(),
      description: proposalDescription.trim(),
      options: validOptions,
      votes: 0,
      likedBy: [],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "proposals", newId), newProposal);
      setProposalInput("");
      setProposalDescription("");
      setProposalOptions([{ prefix: "1.", text: "" }, { prefix: "2.", text: "" }]);
      showToast("お題を提案しました！", "success");
    } catch (e) {
      showToast("投稿に失敗しました", "error");
    }
  };

  const handleOptionChange = (index: number, field: 'prefix' | 'text', value: string) => {
    const newOptions = [...proposalOptions];
    newOptions[index][field] = value;
    setProposalOptions(newOptions);
  };

  const addOption = () => {
    if (proposalOptions.length < 3) {
      setProposalOptions([...proposalOptions, { prefix: (proposalOptions.length + 1) + ".", text: "" }]);
    } else {
      showToast("選択肢は最大3個までです", "error");
    }
  };

  const removeOption = (index: number) => {
    if (proposalOptions.length > 2) {
      const isDefaultNumbering = proposalOptions.every((opt, i) => opt.prefix === `${i + 1}.`);
      let newOptions = proposalOptions.filter((_, i) => i !== index);
      if (isDefaultNumbering) {
        newOptions = newOptions.map((opt, i) => ({ ...opt, prefix: `${i + 1}.` }));
      }
      setProposalOptions(newOptions);
    }
  };

  // --- 分類とソート ---
  const { current, upcoming, archive, official } = useMemo(() => {
    const nowTime = now.getTime();
    const current: Topic[] = [];
    const upcoming: Topic[] = [];
    const archive: Topic[] = [];
    const official: Topic[] = [];

    allTopics.forEach((t) => {
      const isPublished = t.status === 'published';
      const isArchivedType = t.type === 'archive';
      const s = parseDate(t.startDate || new Date().toISOString()).getTime();
      const e = parseDate(t.endDate || new Date().toISOString()).getTime();
      const isEnded = nowTime > e;

      if (isArchivedType) { archive.push(t); return; }
      if (!isPublished) { return; }

      if (t.type === "official") { official.push(t); return; }

      if (nowTime < s) { upcoming.push(t); }
      else if (nowTime >= s && !isEnded) { current.push(t); }
      else if (isEnded) { archive.push(t); }
    });

    const sortByDateDesc = (a: Topic, b: Topic) => parseDate(b.startDate).getTime() - parseDate(a.startDate).getTime();
    const sortByDateAsc = (a: Topic, b: Topic) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();

    current.sort(sortByDateDesc);
    upcoming.sort(sortByDateAsc);
    archive.sort((a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime());
    official.sort(sortByDateDesc);

    return { current, upcoming, archive, official };
  }, [now, allTopics]);

  // Phase Info
  const phase = computePhase(now, phaseMode);

  // ★ ここで「結果を表示していいか」を決定
  // 議論フェーズ または 公開フェーズ、かつ ブラックアウトでない場合のみ TRUE
  const showResults = phase.key === 'discussion' || phase.key === 'public';
  const nextPhaseChange = useMemo(() => {
    const d = new Date(now);
    const day = now.getDay();
    const hour = now.getHours();
    const setTarget = (addDays: number, targetHour: number) => {
      const target = new Date(now);
      target.setDate(target.getDate() + addDays);
      target.setHours(targetHour, 0, 0, 0);
      return target;
    };
    if (day === 1) {
      if (hour < 9) return setTarget(0, 9);
      return setTarget(1, 0);
    }
    if (day === 2 || day === 3 || day === 4) return setTarget(1, 0);
    let daysToMon = (1 + 7 - day) % 7;
    if (daysToMon === 0) daysToMon = 7;
    return setTarget(daysToMon, 9);
  }, [now]);

  const remainingMs = nextPhaseChange.getTime() - now.getTime();
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  // ソート済みアーカイブ
  const sortedArchive = useMemo(() => {
    // ここでフィルタリング処理を追加
    let filtered = archive;

    // 1. フィルタリング処理
    if (filterArchiveType !== 'all') {
      filtered = archive.filter(t => {
        const type = (t as any).archiveType;

        // A. 新しいデータ: archiveType で判定
        if (type) {
          return type === filterArchiveType;
        }

        // B. 古いデータ(タグなし)の自動判別:
        // 常設アーカイブはタイトルに "(過去ログ)" が付いているはずなので、それで判定
        const isLikelyOfficial = t.title.includes("(過去ログ)");

        if (filterArchiveType === 'official') {
          return isLikelyOfficial;
        }
        if (filterArchiveType === 'weekly') {
          return !isLikelyOfficial; // "(過去ログ)"がつかないものは週替わりとみなす
        }
        return true;
      });
    }

    // 2. ソート処理
    const allArchives = [...filtered].sort((a, b) => {
      if (sortArchiveBy === "popularity") {
        const likesA = (a as any).archiveLikes?.length || 0;
        const likesB = (b as any).archiveLikes?.length || 0;
        return likesB - likesA;
      }
      // 日付順
      return parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime();
    });

    // 3. 重複除外処理（常設のオリジナルIDに基づく重複排除）
    const uniqueArchives: Topic[] = [];
    const processedOriginalIds = new Set<string>();

    allArchives.forEach(t => {
      // 常設お題のアーカイブなどで originalEndpointId がある場合
      if ((t as any).originalEndpointId) {
        if (!processedOriginalIds.has((t as any).originalEndpointId)) {
          uniqueArchives.push(t);
          processedOriginalIds.add((t as any).originalEndpointId);
        }
      } else {
        uniqueArchives.push(t);
      }
    });

    return uniqueArchives;
  }, [archive, sortArchiveBy, filterArchiveType]);

  // ソート済み提案
  const sortedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => {
      if (proposalSortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [proposals, proposalSortBy]);

  return (
    <div className="flex justify-center">
      <Toast message={toast?.message || ""} type={toast?.type} onClose={() => setToast(null)} />

      <div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md"><NinjaAdMax admaxId="ccde4842e0ee972292ffd0af14da1153" /></div>

      <div className="w-full max-w-4xl p-4">

        <div className="mb-8 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white p-4 flex justify-center">
          <Image
            src="/odorio-logo.png"
            alt="ODORIO ロゴ"
            width={600}
            height={200}
            className="w-auto h-auto max-w-xs"
            priority
          />
        </div>

        {/* Header */}
        <header className="flex justify-between items-center mb-6 border-b pb-3">
          <div>
            <h1 className="text-2xl font-bold">ODORIO（オドリオ）</h1>
            <div className="text-xs text-gray-500">“今”気になるトピックをみんなで投票・議論</div>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/login" className="text-sm text-gray-700 hover:text-blue-600 hover:underline">
              ゲスト（ログイン）
            </Link>
            <div>
              <ShareButtons url={typeof window !== "undefined" ? window.location.origin : ""} title="ODORIO" />
            </div>
          </div>
        </header>

        {/* ★ スマホ用広告枠 1 (ヘッダー下) */}
        <div className="lg:hidden w-full bg-gray-100 h-24 mb-6 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
          <NinjaAdMax admaxId="a07c96a95bf3065a056c130124ac1992" />
        </div>

        {/* Phase Info */}
        {isMounted && (
          <section style={{ borderColor: phase.color, background: "#fff" }} className="flex items-center gap-3 p-3 border-l-4 rounded-md shadow-md mb-6">
            <div style={{ width: 12, height: 12, borderRadius: 6, background: phase.color }} />
            <div className="flex-1">
              <div className="text-base font-semibold">{phase.label}</div>
              <div className="text-sm text-gray-600">次のフェーズ切替まで：{hours}時間{minutes}分</div>
            </div>
          </section>
        )}

        <main className="min-h-screen bg-gray-50 pb-20">

          {/* 1. 常設のお題 */}
          <TopicSection
            title="🏢 常設のお題"
            topics={official}
            initialCount={2}
            emptyMessage="現在、常設のお題はありません"
            isResultsVisible={showResults} // ★フラグを渡す
          />

          {/* 2. 週替わりお題 */}
          <TopicSection
            title="📅 週替わりお題"
            icon="🔥"
            topics={current}
            initialCount={2}
            emptyMessage="今週のお題はまだありません"
            isResultsVisible={showResults} // ★フラグを渡す
          />

          {/* 3. 次のお題予告 */}
          <TopicSection
            title="🔮 次のお題予告"
            icon="✨"
            topics={upcoming}
            initialCount={2}
            emptyMessage="予告はまだありません"
            isResultsVisible={false} // 予告なので結果は非表示
          />

          {/* ★ スマホ用広告枠 2 (掲示板の上) */}
          <div className="lg:hidden w-full bg-gray-100 h-24 mb-8 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
            <NinjaAdMax admaxId="a07c96a95bf3065a056c130124ac1992" />
          </div>

          {/* 掲示板エリア (提案 & 候補リスト) */}
          <section className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-10">
            <h2 className="text-xl font-black mb-4 text-blue-900">✍️ お題をリクエスト（掲示板）</h2>
            <form onSubmit={submitProposal} className="space-y-4">
              {/* タイトル */}
              <div>
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                  <span>タイトル</span><span>{proposalInput.length}/{MAX_TITLE_LENGTH}</span>
                </label>
                <input
                  value={proposalInput}
                  onChange={e => setProposalInput(e.target.value)}
                  placeholder="例: 犬派？猫派？"
                  className="w-full p-3 border rounded-xl shadow-sm bg-white"
                  maxLength={MAX_TITLE_LENGTH}
                />
              </div>
              {/* 説明 */}
              <div>
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1">説明文</label>
                <textarea
                  value={proposalDescription}
                  onChange={e => setProposalDescription(e.target.value)}
                  placeholder="背景や理由"
                  className="w-full p-3 border rounded-xl h-20 shadow-sm bg-white"
                  maxLength={MAX_DESC_LENGTH}
                />
              </div>
              {/* 選択肢 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1">選択肢</label>
                {proposalOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={opt.prefix} onChange={e => handleOptionChange(i, 'prefix', e.target.value)} className="w-12 text-center p-2 border rounded-lg" />
                    <input value={opt.text} onChange={e => handleOptionChange(i, 'text', e.target.value)} className="flex-1 p-2 border rounded-lg" placeholder="選択肢" />
                    {proposalOptions.length > 2 && <button type="button" onClick={() => removeOption(i)} className="text-red-400">✕</button>}
                  </div>
                ))}
                {proposalOptions.length < 3 && <button type="button" onClick={addOption} className="text-blue-600 text-xs font-black">+ 追加</button>}
              </div>
              <button type="submit" className={`w-full py-2 rounded font-bold ${COLORS.BUTTON_PRIMARY}`}>投稿する</button>
            </form>

            {/* 候補リスト */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">候補リスト</h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setProposalSortBy('votes'); setProposalPage(1); }} className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'votes' ? 'bg-blue-600 text-white' : 'bg-white'}`}>いいね順</button>
                <button onClick={() => { setProposalSortBy('date'); setProposalPage(1); }} className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-white'}`}>新着順</button>
              </div>
              <div className="space-y-2">
                {sortedProposals.slice((proposalPage - 1) * PROPOSALS_PER_PAGE, proposalPage * PROPOSALS_PER_PAGE).map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="font-bold text-sm text-gray-800">{p.title}</div>
                    <button onClick={() => voteProposal(p.id)} className={`px-4 py-1 rounded-full text-xs font-black transition ${((p as any).voterIds || []).includes(userId) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>👍 {p.votes || 0}</button>
                  </div>
                ))}
              </div>
              {/* ページネーション */}
              {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE) > 1 && (
                <div className="flex justify-center gap-4 mt-4 text-xs font-bold text-gray-500">
                  <button onClick={() => setProposalPage(p => Math.max(1, p - 1))} disabled={proposalPage === 1}>前へ</button>
                  <span>{proposalPage} / {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}</span>
                  <button onClick={() => setProposalPage(p => Math.min(Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE), p + 1))} disabled={proposalPage === Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}>次へ</button>
                </div>
              )}
            </div>
          </section>

          {/* ★ スマホ用広告枠 3 (フッター上) */}
          <div className="lg:hidden w-full bg-gray-100 h-24 mb-8 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
            <NinjaAdMax admaxId="a07c96a95bf3065a056c130124ac1992" />
          </div>

          {/* アーカイブ */}
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

              {/* 既存のソートボタン */}
              <div className="flex gap-2">
                <button onClick={() => setSortArchiveBy("date")} className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "date" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}>日付順</button>
                <button onClick={() => setSortArchiveBy("popularity")} className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "popularity" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}>人気順</button>
              </div>
            </div>

            <TopicSection
              title="📦 アーカイブ"
              topics={sortedArchive}
              initialCount={4}
              emptyMessage="アーカイブはありません"
              isResultsVisible={true} // ★アーカイブは常に結果を表示してOK
              onLike={toggleArchiveLike}
              userId={userId}
            />
          </section>

        </main>

        <footer className="p-4 border-t border-gray-200 text-center text-gray-500 text-sm">
          <div className="mb-2 space-x-4">
            <Link href="/guide" className="hover:underline">ODORIOとは？</Link>
            <Link href="/contact" className="hover:underline">お問い合わせ</Link>
            <Link href="/terms" className="hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:underline">プライバシー</Link>
            <Link href="/operator" className="hover:underline">運営者情報</Link>
          </div>
          <p className="text-[10px] uppercase">&copy; ODORIO Project</p>
        </footer>
      </div>
      <div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md"><NinjaAdMax admaxId="ccde4842e0ee972292ffd0af14da1153" /></div>
    </div>
  );
}