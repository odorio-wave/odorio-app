"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// dynamic_topic.ts から必要な型をインポートし、重複するローカル定義を排除
import {
  Topic,
  Proposal,
  ProposalOption,
  TopicVoteResult,
  Option
} from "./dynamic_topic";
import ShareButtons from "./components/ShareButtons";
import Toast from "./components/Toast";

// ★ Firebase Imports ★
// 作成した lib/firebase.ts から db をインポートします
import { db } from "./lib/firebase";
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot, query,
  QuerySnapshot, DocumentSnapshot, DocumentData, QueryDocumentSnapshot,
  arrayUnion, arrayRemove, writeBatch
} from "firebase/firestore";


// --- カラーパレットの定義
const COLORS = {
  BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
  BUTTON_SECONDARY: "bg-gray-200 hover:bg-gray-300 text-gray-800",
  SHARE_X: "bg-black hover:bg-gray-800 text-white",
  SHARE_LINE: "bg-[#06C755] hover:bg-[#05b34c] text-white",
  CARD_BORDER: "border border-gray-200 rounded-lg p-3 shadow-sm",
  PERCENT_YES: "bg-blue-500",
  PERCENT_NO: "bg-purple-500",
};

// 選択肢用の動的カラー配列 (最大5色まで定義)
// 1:青, 2:紫, 3:緑, 4:黄, 5:赤
const OPTION_BG_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500"
];
const OPTION_TEXT_COLORS = [
  "text-blue-600",
  "text-purple-600",
  "text-green-600",
  "text-yellow-600",
  "text-red-600"
];

// 文字数制限の設定
const MAX_TITLE_LENGTH = 40;
const MAX_DESC_LENGTH = 200;
const MAX_OPTION_LENGTH = 30;

// ★ 管理画面用フェーズシミュレーション定数（TopicDetailとの連携用） ★
const MANAGED_PHASE_KEY = "voting";

// --- 単純な日付ユーティリティ
const parseDate = (s: string) => new Date(s);

// --- フェーズの決定（月曜9時切り替えルール）
function computePhase(now: Date, overrideMode: string | null) {
  // 1. 強制指定がある場合 (Firestoreの値を優先)
  if (overrideMode) {
    const mode = overrideMode.trim().toLowerCase(); // 空白削除・小文字化で安全に比較
    if (mode === "voting") return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
    if (mode === "public") return { key: "public", label: "📊 結果公開フェーズ", color: "#f59e0b" };
    if (mode === "blackout") return { key: "blackout", label: "🔒 非公開フェーズ (議論準備)", color: "#6b7280" };
    if (mode === "discussion") return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
  }

  // 2. 指定がない場合 (通常の日付ルール)
  const day = now.getDay();    // 0:Sun, 1:Mon ... 6:Sat
  const hour = now.getHours(); // 0-23

  // 月曜日 (1) の特別処理: 9時までは日曜の続き(議論)、9時から投票開始
  if (day === 1) {
    if (hour < 9) {
      return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
    }
    return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
  }

  // 火曜日 (2) -> 投票
  if (day === 2) return { key: "voting", label: "🗳️ 投票フェーズ", color: "#0ea5e9" };
  // 水曜日 (3) -> 結果公開
  if (day === 3) return { key: "public", label: "📊 結果公開フェーズ", color: "#f59e0b" };
  // 木曜日 (4) -> 非公開
  if (day === 4) return { key: "blackout", label: "🔒 非公開フェーズ (議論準備)", color: "#6b7280" };

  // 金(5), 土(6), 日(0) -> 議論
  return { key: "discussion", label: "🗣️ 議論フェーズ", color: "#10b981" };
}


/* // --- localStorage keys
const LS_PROPOSALS = "site_proposals_v1";
const LS_PROPOSAL_VOTES = "site_proposal_votes_v1";
const LS_ADMIN_TOPICS = "admin_managed_topics_v1";
const ALL_TOPICS_LS_KEY = "admin_all_topics_v1";
const LS_ARCHIVE_VOTES = "site_archive_votes_v1";
const LS_LAST_PROPOSAL_RESET = "site_last_proposal_reset_v1";
const LS_VOTING_COMMENTS = "voting_comments_v2"; */

// --- 投票結果の計算 (Firestoreデータを使用) ---
function getTopicVotes(t: any): TopicVoteResult {
  // Firestoreのデータ構造: t.votes = { optionId: count, ... }
  const votes = t.votes || {};
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

  // 互換性のための yes/no
  const yesVotes = optionsResult[0]?.count || 0;
  const noVotes = optionsResult[1]?.count || 0;
  const yesPct = optionsResult[0]?.percentage || 0;
  const noPct = optionsResult[1]?.percentage || 0;

  return {
    yes: yesVotes, no: noVotes, yesPercentage: yesPct, noPercentage: noPct,
    totalVotes: total,
    options: optionsResult
  };
}

// --- 自動アーカイブフック ---
// ★ 自動アーカイブ処理 (Firestore版) ★
// ※ 誰かがページを開いたときにチェックし、必要ならFirestoreを更新する
function useCheckAndArchive(initialTopics: Topic[], now: Date, onUpdate: () => void) {
  useEffect(() => {
    if (!initialTopics || initialTopics.length === 0) return;
    const nowTime = now.getTime();

    initialTopics.forEach(async (t) => {
      const endDate = parseDate(t.endDate).getTime();

      // 期限切れチェック
      if (nowTime > endDate && t.status === 'published' && t.type !== 'archive') {

        if (t.type === 'weekly') {
          // 週替わり: アーカイブ化
          try {
            if (t.topicId) {
              await updateDoc(doc(db, "topics", t.topicId), { type: 'archive', status: 'archived' });
            }
          } catch (e) { console.error(e); }
        }
        else if (t.type === 'official') {
          // 常設: コピーしてアーカイブ & 本体延長
          const archiveId = `${t.id}_${Math.floor(Date.now() / 1000)}`;
          const archiveData = {
            ...t,
            topicId: archiveId,
            id: archiveId,
            type: 'archive',
            status: 'archived',
            originalEndpointId: t.id,
            title: `${t.title} (過去ログ)`,
            archiveLikes: []
          };

          const nextStart = new Date();
          const nextEnd = new Date(nextStart);
          nextEnd.setDate(nextEnd.getDate() + 7);

          try {
            const batch = writeBatch(db);
            batch.set(doc(db, "topics", archiveId), archiveData);
            if (t.topicId) {
              batch.update(doc(db, "topics", t.topicId), {
                startDate: nextStart.toISOString(),
                endDate: nextEnd.toISOString()
              });
            }
            await batch.commit();
          } catch (e) { console.error(e); }
        }
      }
    });
  }, [now, initialTopics, onUpdate]);
}


export default function Home() {
  const [now, setNow] = useState<Date>(new Date());
  const [allTopics, setAllTopics] = useState<Topic[]>([]); // Firestoreから取得したお題
  const [proposals, setProposals] = useState<Proposal[]>([]); // Firestoreから取得した提案
  const [allVotesData, setAllVotesData] = useState<Record<string, Record<string, string>>>({});
  const [phaseMode, setPhaseMode] = useState(null);

  // 入力フォーム状態
  const [proposalInput, setProposalInput] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([
    { prefix: "1.", text: "" },
    { prefix: "2.", text: "" },
  ]);

  // UI状態
  const [sortArchiveBy, setSortArchiveBy] = useState<"date" | "popularity">("date");

  // 週替わりお題のリスト表示状態を管理
  const [proposalSortBy, setProposalSortBy] = useState<"votes" | "date">("votes");
  const [showAllCurrentTopics, setShowAllCurrentTopics] = useState(false);

  // クライアント側でマウントされたかを追跡する State
  const [isMounted, setIsMounted] = useState(false);
  const [proposalVoteTrigger, setProposalVoteTrigger] = useState(0);
  const [archiveVotesMap, setArchiveVotesMap] = useState<Record<string, string[]>>({});

  // データ更新トリガー
  const [dataUpdateTrigger, setDataUpdateTrigger] = useState(0);

  // トースト状態
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  // ページネーション用の状態 (ユーザー提案)
  const [proposalPage, setProposalPage] = useState(1);
  const PROPOSALS_PER_PAGE = 10;

  // ユーザーID (ブラウザ保存のまま)
  /* const getUserId = () => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("site_userid_v1");
    if (!id) {
      id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("site_userid_v1", id);
    }
    return id;
  }; */

  // --- データ取得 (Realtime Listener) ---
  useEffect(() => {
    setIsMounted(true);
    let storedUid = localStorage.getItem("site_userid_v1");
    if (!storedUid) {
      storedUid = `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("site_userid_v1", storedUid);
    }
    setUserId(storedUid);

    // snapshot などの引数に型を付与
    // ★ Firestore 購読 (型付き) ★
    const unsubTopics = onSnapshot(query(collection(db, "topics")), (snapshot: QuerySnapshot<DocumentData>) => {
      const list = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data(), id: d.id } as Topic));
      setAllTopics(list);
    });

    const unsubProposals = onSnapshot(query(collection(db, "proposals")), (snapshot: QuerySnapshot<DocumentData>) => {
      const list = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data(), id: d.id } as Proposal));
      setProposals(list);
    });

    const unsubConfig = onSnapshot(doc(db, "system", "config"), (docSnap) => {
      if (docSnap.exists()) {
        // Firestoreから phaseMode を取得してセット
        setPhaseMode(docSnap.data().phaseMode || null);
      } else {
        setPhaseMode(null);
      }
    });

    const unsubVotes = onSnapshot(query(collection(db, "topic_votes")), (snapshot: QuerySnapshot<DocumentData>) => {
      const data: Record<string, Record<string, string>> = {};
      snapshot.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
        data[d.id] = d.data() as Record<string, string>;
      });
      setAllVotesData(data);
    });

    const timerId = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      unsubTopics();
      unsubProposals();
      unsubConfig();
      unsubVotes();
      clearInterval(timerId);
    };
  }, []);

  // 自動アーカイブ実行
  useCheckAndArchive(allTopics, now, () => setDataUpdateTrigger(prev => prev + 1));

  // お題候補へのいいね
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

  // アーカイブへのいいね
  const voteArchivedTopic = async (topicId: string) => {
    if (!userId) return;
    const target = allTopics.find(t => t.id === topicId);
    if (!target) return;
    const likes = (target as any).archiveLikes || [];
    const ref = doc(db, "topics", topicId);
    try {
      if (likes.includes(userId)) await updateDoc(ref, { archiveLikes: arrayRemove(userId) });
      else { await updateDoc(ref, { archiveLikes: arrayUnion(userId) }); showToast("いいねしました！"); }
    } catch (e) { console.error(e); }
  };

  // お題の提案
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
      likedBy: [], // いいねしたユーザーIDリスト
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

  // 選択肢の変更ハンドラ (変更なし)
  const handleOptionChange = (index: number, field: 'prefix' | 'text', value: string) => {
    const newOptions = [...proposalOptions];
    newOptions[index][field] = value;
    setProposalOptions(newOptions);
  };

  // 選択肢の追加/削除 (最大数を3個に制限)
  const addOption = () => {
    if (proposalOptions.length < 3) {
      setProposalOptions([...proposalOptions, { prefix: (proposalOptions.length + 1) + ".", text: "" }]);
    } else {
      showToast("選択肢は最大3個までです", "error");
    }
  };

  const removeOption = (index: number) => {
    if (proposalOptions.length > 2) {
      // 1. 現在のリストがデフォルトの連番形式（"1.", "2."...）かどうかをチェック
      // (すべての要素が「インデックス+1 + "."」であればデフォルトとみなす)
      const isDefaultNumbering = proposalOptions.every((opt, i) => opt.prefix === `${i + 1}.`);

      // 2. 削除実行
      let newOptions = proposalOptions.filter((_, i) => i !== index);

      // 3. デフォルト連番だった場合のみ、番号を振り直す（詰める）
      // それ以外（ユーザーがカスタムした文字など）の場合は、そのまま維持する
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

      if (t.type === "official") {
        official.push(t);
        return;
      }

      if (nowTime < s) {
        upcoming.push(t);
      } else if (nowTime >= s && !isEnded) {
        current.push(t);
      } else if (isEnded) {
        // ※ useCheckAndArchiveでFirestoreが更新されるまでの間の一時的な表示
        archive.push(t);
      }
    });

    const sortByDateDesc = (a: Topic, b: Topic) => parseDate(b.startDate).getTime() - parseDate(a.startDate).getTime();
    const sortByDateAsc = (a: Topic, b: Topic) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();

    current.sort(sortByDateDesc);
    upcoming.sort(sortByDateAsc);
    archive.sort((a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime());
    official.sort(sortByDateDesc);

    return { current, upcoming, archive, official };
  }, [now, allTopics]);

  // トピックの投票結果を読み込む (カスタムフックの代わりに直接関数を呼び出す)
  const allTopicsForVotes = useMemo(() => [...official, ...current, ...archive], [official, current, archive]);
  const topicVoteResults = useMemo(() => getTopicVotes(allTopicsForVotes), [allTopicsForVotes]);

  // フェーズ情報
  const phase = computePhase(now, phaseMode);
  const isPublicOrDiscussion = phase.key === 'public' || phase.key === 'discussion';
  const isBlackout = phase.key === 'blackout';
  const isVotingPhase = phase.key === 'voting';
  const isDiscussionPhase = phase.key === 'discussion';

  // カウントダウン
  const nextPhaseChange = useMemo(() => {
    const d = new Date(now);
    const day = now.getDay();
    const hour = now.getHours();

    // 目標とする日時を設定するヘルパー
    const setTarget = (addDays: number, targetHour: number) => {
      const target = new Date(now);
      target.setDate(target.getDate() + addDays);
      target.setHours(targetHour, 0, 0, 0);
      return target;
    };

    if (day === 1) { // 月曜
      if (hour < 9) return setTarget(0, 9); // 当日9時まで（議論終了）
      return setTarget(1, 0); // 翌日0時まで（投票終了->火曜へ）※火曜も投票ならこのままでOK
    }
    if (day === 2) return setTarget(1, 0); // 水曜0時まで
    if (day === 3) return setTarget(1, 0); // 木曜0時まで
    if (day === 4) return setTarget(1, 0); // 金曜0時まで

    // 金(5), 土(6), 日(0) -> 次の月曜9時まで
    let daysToMon = (1 + 7 - day) % 7;
    if (daysToMon === 0) daysToMon = 7; // 日曜の場合は翌日
    return setTarget(daysToMon, 9);

  }, [now]);

  const remainingMs = nextPhaseChange.getTime() - now.getTime();
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  // アーカイブのグルーピング表示
  const sortedArchive = useMemo(() => {
    // 1. 全てソート
    const allArchives = [...archive].sort((a, b) => {
      if (sortArchiveBy === "popularity") {
        const votesA = archiveVotesMap[a.id]?.length || 0;
        const votesB = archiveVotesMap[b.id]?.length || 0;
        if (votesA !== votesB) {
          return votesB - votesA;
        }
      }
      return parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime();
    });

    // 2. 常設お題の過去ログは最新1つのみ表示
    const uniqueArchives: Topic[] = [];
    const processedOriginalIds = new Set<string>();

    allArchives.forEach(t => {
      if (t.originalEndpointId) {
        if (!processedOriginalIds.has(t.originalEndpointId)) {
          uniqueArchives.push(t);
          processedOriginalIds.add(t.originalEndpointId);
        }
      } else {
        uniqueArchives.push(t);
      }
    });

    return uniqueArchives;
  }, [archive, sortArchiveBy, archiveVotesMap]);

  // ヘルパー: トピックのシェアURL構築 (変更なし)
  const buildTopicUrl = (t: Topic) => {
    if (typeof window === "undefined") return "http://localhost:3000";
    return encodeURIComponent(window.location.origin + `/topic/${t.topicId || t.id}`);
  };

  // お題候補のソート
  const sortedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => {
      if (proposalSortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [proposals, proposalSortBy]);

  const TopicCard = ({ t, isWeekly = false }: { t: Topic, isWeekly?: boolean }) => {
    const result = getTopicVotes(t); // Firestoreデータから計算
    const showResults = isPublicOrDiscussion && !isBlackout;
    const voteOptions = result?.options || [];

    let buttonText = "参加する";
    let buttonBg = COLORS.BUTTON_PRIMARY;

    if (isDiscussionPhase || isPublicOrDiscussion) {
      buttonText = "議論を見る";
      buttonBg = "bg-gray-800 text-white hover:bg-gray-700";
    } else if (isVotingPhase && isWeekly) {
      buttonText = "投票する";
      buttonBg = COLORS.BUTTON_PRIMARY;
    }

    return (
      <article className={COLORS.CARD_BORDER} key={t.id}>
        <h4 className="text-lg font-semibold mb-1">{t.title}</h4>
        <p className="text-sm text-gray-500 mb-2">{t.description}</p>

        {showResults && voteOptions.length > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-xs font-medium mb-1">
              {voteOptions.map((opt: any, index: number) => (
                <span key={opt.id} className={OPTION_TEXT_COLORS[index % OPTION_TEXT_COLORS.length]}>
                  {opt.text} {opt.percentage}%
                </span>
              ))}
            </div>
            <div className="flex h-2 rounded overflow-hidden">
              {voteOptions.map((opt: any, index: number) => (
                <div key={opt.id} style={{ width: `${opt.percentage}%` }} className={OPTION_BG_COLORS[index % OPTION_BG_COLORS.length]} />
              ))}
            </div>
          </div>
        )}

        {isBlackout && (
          <div className="mb-2 text-sm text-gray-500 p-2 border rounded-md">
            本日は結果非公開期間です
          </div>
        )}

        <div className="flex justify-between items-center gap-2 mt-3">
          <Link href={`/topic/${t.topicId || t.id}`}>
            <button className={`py-1.5 px-3 rounded-md border-none ${buttonBg}`}>
              {buttonText}
            </button>
          </Link>
          <div className="flex gap-1.5">
            <a href={`https://x.com/intent/tweet?url=${buildTopicUrl(t)}&text=${encodeURIComponent(t.title)}`} target="_blank" rel="noreferrer">
              <button className={`${COLORS.SHARE_X} text-sm py-1 px-2`}>X共有</button>
            </a>
            <a href={`https://social-plugins.line.me/lineit/share?url=${buildTopicUrl(t)}`} target="_blank" rel="noreferrer">
              <button className={`${COLORS.SHARE_LINE} text-sm py-1 px-2`}>LINE</button>
            </a>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="flex justify-center">
      {/* Toast コンポーネントを配置 */}
      <Toast message={toast?.message || ""} type={toast?.type} onClose={() => setToast(null)} />

      {/* --- 左広告（PCのみ表示） --- */}
      <div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md">
        📢 左広告
      </div>
      <div className="w-full max-w-4xl p-4">
        {/* ===== Header ===== */}
        <header className="flex justify-between items-center mb-6 border-b pb-3">
          <div>
            <h1 className="text-2xl font-bold">ODORIO（オドリオ）投票×議論</h1>
            <div className="text-xs text-gray-500">“今”気になるトピックをみんなで投票・議論</div>
          </div>

          <div className="flex gap-3 items-center">
            {/* ログインページへのリンク */}
            <Link href="/login" className="text-sm text-gray-700 hover:text-blue-600 hover:underline">
              ゲスト（ログイン）
            </Link>

            {/* シェアボタンコンポーネントの使用 */}
            <div className="hidden sm:block">
              <ShareButtons
                url={typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                title="ODORIO — 投票×議論"
              />
            </div>
          </div>
        </header>

        {/* スマホ用広告枠 (ヘッダー下) */}
        <div className="lg:hidden w-full bg-gray-100 h-24 mb-6 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
          [スマホ用広告スペース]
        </div>

        {/* ===== Phase box ===== (省略) */}
        {isMounted && (
          <section style={{ borderColor: phase.color, background: "#fff" }} className="flex items-center gap-3 p-3 border-l-4 rounded-md shadow-md mb-6">
            <div style={{ width: 12, height: 12, borderRadius: 6, background: phase.color }} />
            <div className="flex-1">
              <div className="text-base font-semibold">{phase.label}</div>
              <div className="text-sm text-gray-600">次のフェーズ切替まで：{hours}時間{minutes}分</div>
            </div>
          </section>
        )}

        {/* isMounted が false の間は静的なプレースホルダーを表示 (任意) */}
        {!isMounted && (
          <section className="flex items-center gap-3 p-3 border-l-4 rounded-md shadow-md mb-6 border-gray-400 bg-white animate-pulse">
            <div className="flex-1">
              <div className="text-base font-semibold text-gray-400">ロード中...</div>
              <div className="text-sm text-gray-300">フェーズ判定を待っています</div>
            </div>
          </section>
        )}

        <main className="space-y-12">
          {/* お題一覧 */}
          <section>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
              🔥 現在公開中のお題
            </h2>
            {official.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">
                  🏢 常設のお題
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{official.map((t) => <TopicCard key={t.id} t={t} />)}</div>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                📅 週替わりお題
              </h3>
              {current.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{current.slice(0, showAllCurrentTopics ? current.length : 4).map((t) => <TopicCard key={t.id} t={t} isWeekly={true} />)}</div>
                  {current.length > 4 && <div className="text-center mt-4"><button onClick={() => setShowAllCurrentTopics(!showAllCurrentTopics)} className={`${COLORS.BUTTON_SECONDARY} py-2 px-4 rounded-md font-semibold text-sm`}>{showAllCurrentTopics ? '▲ 戻す' : '▼ もっと見る'}</button></div>}
                </>
              ) : <p className="text-gray-500 text-sm">現在、週替わりのお題はありません。</p>}
            </div>
          </section>

          {/* ... Next topics preview (省略) ... */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-3">
              🔮 次のお題予告（毎週土曜 9:00）
            </h2>
            {upcoming.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {upcoming.slice(0, 3).map((t) => {
                  const shareUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                  const shareText = `次回のお題予告: 「${t.title}」\n${new Date(t.startDate).toLocaleDateString()} 公開予定！\n#ODORIO`;

                  return (
                    <div key={t.id} className="min-w-[240px] flex-shrink-0 bg-white shadow-md p-3 rounded-md border border-gray-100">
                      <div className="text-base text-gray-900 font-semibold">{t.title}</div>
                      <div className="mt-1 text-sm text-gray-500">公開予定: {t.startDate.slice(0, 10)}</div>
                      <div className="mt-3 flex gap-2">
                        <a
                          href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <button className={`${COLORS.SHARE_X} py-1 px-2 rounded-md text-xs font-bold`}>
                            X で予告
                          </button>
                        </a>
                        <a
                          href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <button className="py-1 px-2 rounded-md bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold">
                            LINE
                          </button>
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500">次のお題は未定です。</p>
            )}
          </section>

          {/* スマホ用広告枠 (提案エリア上) */}
          <div className="lg:hidden w-full bg-gray-100 h-24 mb-8 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
            [スマホ用広告スペース]
          </div>

          {/* 提案エリア */}
          <section className="bg-blue-50 p-6 rounded-3xl border border-blue-100 ">
            <h2 className="text-xl font-black mb-4 text-blue-900">
              ✍️ お題をリクエスト
            </h2>
            <form onSubmit={submitProposal} className="space-y-4">
              {/* タイトル入力 */}
              <div>
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                  <span>
                    お題のタイトル
                  </span>
                  <span>
                    {MAX_TITLE_LENGTH}文字以内
                  </span>
                </label>
                <div className="relative">
                  <input
                    value={proposalInput}
                    onChange={e => setProposalInput(e.target.value)}
                    placeholder="例: 犬派？猫派？ (40文字以内)"
                    className="w-full p-3 border rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-blue-400"
                    maxLength={MAX_TITLE_LENGTH}
                  />
                  <span className={`absolute right-3 top-3.5 text-[10px] font-bold ${proposalInput.length >= MAX_TITLE_LENGTH ? 'text-red-500' : 'text-gray-300'}`}>
                    {proposalInput.length}/{MAX_TITLE_LENGTH}
                  </span>
                </div>
              </div>

              {/* 説明入力 */}
              <div>
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                  <span>説明文</span>
                  <span>{MAX_DESC_LENGTH}文字以内</span>
                </label>
                <div className="relative">
                  <textarea
                    value={proposalDescription}
                    onChange={e => setProposalDescription(e.target.value)}
                    placeholder="背景や理由を記述してください(200文字以内)"
                    className="w-full p-3 border rounded-xl h-20 shadow-sm bg-white focus:ring-2 focus:ring-blue-400"
                    maxLength={MAX_DESC_LENGTH}
                  />
                  <span className={`absolute bottom-2 right-3 text-[10px] font-bold ${proposalDescription.length >= MAX_DESC_LENGTH ? 'text-red-500' : 'text-gray-300'}`}>
                    {proposalDescription.length}/{MAX_DESC_LENGTH}
                  </span>
                </div>
              </div>

              {/* 選択肢入力 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                  <span>選択肢 (最大3つ)</span>
                  <span className="text-blue-500 underline font-black">
                    各 {MAX_OPTION_LENGTH} 文字以内
                  </span>
                </label>
                {proposalOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
                    <input
                      value={opt.prefix}
                      onChange={e => handleOptionChange(i, 'prefix', e.target.value)}
                      placeholder="1."
                      className="w-12 text-center p-2 border rounded-lg bg-white text-sm font-bold shadow-sm"
                    />
                    <div className="relative flex-1">
                      <input
                        value={opt.text}
                        onChange={e => handleOptionChange(i, 'text', e.target.value)}
                        placeholder={`選択肢を入力 (${MAX_OPTION_LENGTH}文字以内)`}
                        className="w-full p-2 border rounded-lg bg-white text-sm shadow-sm pr-10 focus:ring-2 focus:ring-blue-400"
                        maxLength={MAX_OPTION_LENGTH}
                      />
                      <span className={`absolute right-2 top-2.5 text-[10px] font-bold ${opt.text.length >= MAX_OPTION_LENGTH ? 'text-red-500' : 'text-gray-300'}`}>
                        {opt.text.length}/{MAX_OPTION_LENGTH}
                      </span>
                    </div>
                    {proposalOptions.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600 p-1">
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {proposalOptions.length < 3 && (
                  <button type="button" onClick={addOption} className="text-blue-600 text-xs font-black flex items-center gap-1 hover:bg-white/50 px-2 py-1.5 rounded-lg border border-dashed border-blue-300 ml-1 transition">
                    ＋ 3つ目の選択肢を追加する
                  </button>
                )}
              </div>

              <button type="submit" className={`w-full py-2 rounded font-bold ${COLORS.BUTTON_PRIMARY}`}>
                お題を投稿する
              </button>
            </form>

            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">
                候補リスト
              </h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setProposalSortBy('votes'); setProposalPage(1); }} className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'votes' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                  いいね順
                </button>
                <button onClick={() => { setProposalSortBy('date'); setProposalPage(1); }} className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                  新着順
                </button>
              </div>
              <div className="space-y-2">
                {sortedProposals.slice((proposalPage - 1) * PROPOSALS_PER_PAGE, proposalPage * PROPOSALS_PER_PAGE).map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm border border-blue-50">
                    <div className="font-bold text-sm text-gray-800">{p.title}</div>
                    <button onClick={() => voteProposal(p.id)} className={`px-4 py-1 rounded-full text-xs font-black transition ${((p as any).voterIds || []).includes(userId) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      👍 {p.votes || 0}
                    </button>
                  </div>
                ))}
              </div>
              {/* ページネーション */}
              {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE) > 1 && (
                <div className="flex justify-center gap-4 mt-4 text-xs font-bold text-gray-500">
                  <button onClick={() => setProposalPage(p => Math.max(1, p - 1))} disabled={proposalPage === 1}>
                    前へ
                  </button>
                  <span>{proposalPage} / {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}</span>
                  <button onClick={() => setProposalPage(p => Math.min(Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE), p + 1))} disabled={proposalPage === Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}>
                    次へ
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* スマホ用広告枠 (フッター上) */}
          <div className="lg:hidden w-full bg-gray-100 h-24 mt-8 flex items-center justify-center text-gray-400 text-sm border border-gray-200">
            [スマホ用広告スペース]
          </div>

          {/* アーカイブ */}
          <section className="pb-10">
            <h2 className="text-xl font-black mb-4 text-gray-400">
              📦 アーカイブ
            </h2>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSortArchiveBy("date")} className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "date" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}>
                日付順
              </button>
              <button onClick={() => setSortArchiveBy("popularity")} className={`text-xs px-2 py-1 rounded border ${sortArchiveBy === "popularity" ? COLORS.BUTTON_PRIMARY : COLORS.BUTTON_SECONDARY}`}>
                人気順
              </button>
            </div>
            <div className="grid gap-2">
              {sortedArchive.map(t => (
                <div key={t.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                  <div><h4 className="font-bold text-gray-700">{t.title}</h4><p className="text-[10px] text-gray-400">{t.endDate.slice(0, 10)} 終了</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => voteArchivedTopic(t.id)} className={`text-xs px-3 py-1 rounded-full font-bold border transition ${((t as any).archiveLikes || []).includes(userId) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-400'}`}>👍 {((t as any).archiveLikes || []).length}</button>
                    <Link href={`/topic/${t.id}`}><button className="text-xs px-2 py-1 bg-gray-800 text-white rounded">見る</button></Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main >

        {/* Footer */}
        < footer className="p-4 border-t border-gray-200 text-center text-gray-500 text-sm" >
          <div className="mb-2 space-x-4">
            {/* サイトについてへのリンク */}
            <Link href="/guide" className="hover:text-blue-600 hover:underline">サイトについて</Link>
            <Link href="/terms" className="hover:text-blue-600 hover:underline">利用規約</Link>
            <Link href="/privacy" className="hover:text-blue-600 hover:underline">プライバシー</Link>
            <Link href="/operator" className="hover:text-blue-600 hover:underline">運営者情報</Link>
            <Link href="/contact" className="hover:text-blue-600 hover:underline">お問い合わせ</Link>
          </div>
          <p className="text-[10px] text-gray-300 font-black tracking-widest uppercase">&copy; {new Date().getFullYear()} ODORIO Project</p>
        </footer>
      </div >

      {/* --- 右広告（PCのみ表示） --- */}
      < div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md" >
        📢 右広告
      </div >
    </div >
  );
}

