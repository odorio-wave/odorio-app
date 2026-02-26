"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import NinjaAdMax from "@/app/components/NinjaAdMax";

// Firebase
import { db } from "../../lib/firebase";
import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy,
    increment, writeBatch, arrayUnion, arrayRemove,
    getDoc
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// Components & Types
import ShareButtons from "../../components/ShareButtons";
import Toast from "../../components/Toast";
import {
    Reason, Reasons, Comment,
    DynamicTopicData
} from "../../dynamic_topic";

// 複数人の管理者がいる場合はカンマ区切りで追加できます ["uid1", "uid2"]
const ADMIN_UIDS = ["jzLjT7Sbgle1nb1WOmPBUI5BdRR2", "shztCDby7vdjiD0UdosXVPxMSVx1"];

// --- Constants ---
const COLORS = {
    YES_BUTTON: "bg-blue-600 hover:bg-blue-700",
    NO_BUTTON: "bg-purple-600 hover:bg-purple-700",
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    REVOTE_BUTTON: "bg-orange-500 hover:bg-orange-600",
    VOTED_ACTIVE: "ring-4 ring-offset-2 ring-yellow-400/80",
    TAB_ACTIVE: "bg-gray-800 text-white font-bold shadow-sm",
    TAB_INACTIVE: "bg-gray-100 text-gray-600 hover:bg-gray-200",
    REVOTER_MARK: "text-orange-600",
};

const BUTTON_COLORS = [
    "bg-blue-600 hover:bg-blue-700",      // 1番目: 青
    "bg-purple-600 hover:bg-purple-700",  // 2番目: 紫
    "bg-green-600 hover:bg-green-700",    // 3番目: 緑
    "bg-yellow-500 hover:bg-yellow-600",  // 4番目: 黄
    "bg-red-600 hover:bg-red-700"         // 5番目: 赤
];

const OPTION_TEXT_COLORS = ["text-blue-600", "text-purple-600", "text-green-600", "text-yellow-600", "text-red-600"];
const OPTION_BG_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];

const MAX_REASON_LENGTH = 100;
const MAX_COMMENT_LENGTH = 200;
const POST_COOLDOWN_MS = 2000;

// フェーズ自動判定
function computePhase(now: Date, overrideMode: string | null) {
    if (overrideMode) {
        const mode = overrideMode.trim().toLowerCase();
        if (mode === "voting") return { key: "voting" };
        if (mode === "public") return { key: "public" };
        if (mode === "blackout") return { key: "blackout" };
        if (mode === "discussion") return { key: "discussion" };
    }
    const day = now.getDay();
    const hour = now.getHours();
    if (day === 1 && hour < 9) return { key: "discussion" };
    if (day === 1 || day === 2) return { key: "voting" };
    if (day === 3) return { key: "public" };
    if (day === 4) return { key: "blackout" };
    return { key: "discussion" };
}

export default function TopicClient({ id }: { id: string }) {
    const router = useRouter();
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    // --- States ---
    const [loading, setLoading] = useState(true);
    const [topicData, setTopicData] = useState<DynamicTopicData | null>(null);
    const [now, setNow] = useState<Date>(new Date());
    const [phaseMode, setPhaseMode] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>("");
    // 表示件数の設定 (デフォルト20件)
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // 自分の投票状態
    const [voteChoice, setVoteChoice] = useState<string | null>(null);
    // 生データと計算結果を分ける
    const [rawRevoteData, setRawRevoteData] = useState<{ isRevote: boolean, updatedAt: number } | null>(null);

    // 実際に画面で使う isReVoter は計算で求める
    const isReVoter = useMemo(() => {
        if (!rawRevoteData || !rawRevoteData.isRevote) return false;
        if (!topicData || !topicData.startDate) return false; // お題データがまだない

        // お題の開始日時
        const topicStart = new Date(topicData.startDate).getTime();

        // 再投票の日時 (データがない古い形式の場合は 0 になるので、リセット後は false になる＝正しい挙動)
        const revoteTime = rawRevoteData.updatedAt || 0;

        // 「お題開始後に再投票した」場合のみ true
        return revoteTime > topicStart;
    }, [rawRevoteData, topicData]);

    // データ群
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [reasons, setReasons] = useState<Reasons>({});
    const [comments, setComments] = useState<Comment[]>([]);

    // UI States
    const [reason, setReason] = useState("");
    const [newComment, setNewComment] = useState("");
    const [requireReason, setRequireReason] = useState(false);
    const [tempReVoteChoice, setTempReVoteChoice] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [sortBy, setSortBy] = useState<"newest" | "likes">("likes");
    const [isReasonsExpanded, setIsReasonsExpanded] = useState(false);
    const [activeBoardTab, setActiveBoardTab] = useState<string>('discussion');
    const [quoteNumber, setQuoteNumber] = useState<number | null>(null);
    const [commentPage, setCommentPage] = useState(1);

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        setToast({ message, type });
    };

    // 連投チェック関数
    const checkCooldown = () => {
        const lastPostTime = localStorage.getItem("last_post_time");
        if (lastPostTime) {
            const elapsed = Date.now() - parseInt(lastPostTime);
            if (elapsed < POST_COOLDOWN_MS) {
                const remaining = Math.ceil((POST_COOLDOWN_MS - elapsed) / 1000);
                showToast(`あと ${remaining}秒 お待ちください`, "info");
                return false;
            }
        }
        return true;
    };

    // 投稿成功時のタイムスタンプ更新
    const updateLastPostTime = () => {
        localStorage.setItem("last_post_time", Date.now().toString());
    };


    // --- Actions ---
    const handleLikeReason = async (reasonId: string | undefined, likedUserIds: string[]) => {
        if (!reasonId) return;
        if (!userId) return showToast("いいねするにはログインが必要です", "error");
        const isLiked = likedUserIds.includes(userId);
        const ref = doc(db, "topics", id, "reasons", reasonId);
        try {
            if (isLiked) await updateDoc(ref, { likedUserIds: arrayRemove(userId), likeCount: increment(-1) });
            else await updateDoc(ref, { likedUserIds: arrayUnion(userId), likeCount: increment(1) });
        } catch (e) { console.error(e); }
    };

    const handleReportReason = async (reasonId: string | undefined, reasonUserId: string) => {
        if (!reasonId) return;
        if (userId === reasonUserId) return;
        if (!confirm("不適切な投稿として通報しますか？")) return;
        try {
            const ref = doc(db, "topics", id, "reasons", reasonId);
            await updateDoc(ref, { reports: increment(1) });
            setReportedIds(prev => new Set(prev).add(reasonId));
            showToast("通報しました", "info");
        } catch (e) { showToast("エラー", "error"); }
    };

    const handleLikeComment = async (commentId: string, likedUserIds: string[]) => {
        if (!userId) return showToast("いいねするにはログインが必要です", "error");
        const isLiked = likedUserIds.includes(userId);
        const ref = doc(db, "topics", id, "comments", commentId);
        try {
            if (isLiked) await updateDoc(ref, { likedUserIds: arrayRemove(userId), likeCount: increment(-1) });
            else await updateDoc(ref, { likedUserIds: arrayUnion(userId), likeCount: increment(1) });
        } catch (e) { console.error(e); }
    };

    const handleReportComment = async (comment: any) => {
        if (!confirm("通報しますか？")) return;
        try {
            await updateDoc(doc(db, "topics", id, "comments", comment.id), { reports: increment(1) });
            setReportedIds(prev => new Set(prev).add(comment.id));
            showToast("通報しました", "info");
        } catch (e) { showToast("エラー", "error"); }
    };

    // --- データ取得 ---
    useEffect(() => {
        // IDがない時は、ただ中断するのではなく「読み込み完了（でもデータなし）」の状態にする
        if (!id) {
            console.error("IDが渡されていません");
            setLoading(false);
            return;
        }
        let unsubData: (() => void) | undefined;
        let unsubAuth: (() => void) | undefined;

        const subscribeData = (uid: string) => {
            const unsubTopic = onSnapshot(doc(db, "topics", id), (d) => {
                if (d.exists()) {
                    const data = d.data();
                    if (!data.votes) data.votes = {};
                    setTopicData({ ...data, topicId: d.id } as unknown as DynamicTopicData);
                } else setTopicData(null);
                setLoading(false);
            }, () => setLoading(false));

            const unsubConfig = onSnapshot(doc(db, "system", "config"), (s) => {
                if (s.exists()) setPhaseMode(s.data().phaseMode || null);
            });

            const unsubVotes = onSnapshot(doc(db, "topic_votes", id), (s) => {
                if (s.exists()) {
                    const data = s.data() as Record<string, string>;
                    setVoteChoice(data[uid] || null);
                    const counts: Record<string, number> = {};
                    Object.values(data).forEach(optId => counts[optId] = (counts[optId] || 0) + 1);
                    setVotes(counts);
                }
            });

            const unsubReVoter = onSnapshot(doc(db, "topic_revoters", id), (s) => {
                if (s.exists()) {
                    const data = s.data()[uid];
                    if (data) {
                        // オブジェクト形式(新)か、ブーリアン(旧)かを判定
                        if (typeof data === 'object') {
                            setRawRevoteData({
                                isRevote: data.isReVoter,
                                updatedAt: new Date(data.updatedAt).getTime()
                            });
                        } else {
                            // 古いデータ(trueのみ)の場合、時刻は0扱い
                            setRawRevoteData({ isRevote: !!data, updatedAt: 0 });
                        }
                    } else {
                        setRawRevoteData(null);
                    }
                }
            });

            const unsubReasons = onSnapshot(query(collection(db, "topics", id, "reasons")), (snap) => {
                const reasonsObj: Reasons = {};
                snap.docs.forEach(d => {
                    const r = d.data() as Reason;
                    const reasonWithId = { ...r, id: d.id, likedUserIds: r.likedUserIds || [], likeCount: r.likeCount || 0 };
                    if (!reasonsObj[r.voteOptionId]) reasonsObj[r.voteOptionId] = [];
                    reasonsObj[r.voteOptionId].push(reasonWithId);
                });
                setReasons(reasonsObj);
            });

            const unsubComments = onSnapshot(query(collection(db, "topics", id, "comments"), orderBy("timestamp", "asc")), (snap) => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as Comment));
                setComments(list);
            });

            return () => { unsubTopic(); unsubConfig(); unsubVotes(); unsubReVoter(); unsubReasons(); unsubComments(); };
        };

        const initAuth = async () => {
            const auth = getAuth();
            unsubAuth = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    if (unsubData) unsubData();
                    unsubData = subscribeData(user.uid);
                } else {
                    await signInAnonymously(auth);
                }
            });
        };

        initAuth();
        const timerId = setInterval(() => setNow(new Date()), 60000);
        return () => { clearInterval(timerId); if (unsubAuth) unsubAuth(); if (unsubData) unsubData(); };
    }, [id]);

    // --- 計算 ---
    const phaseObj = computePhase(now, phaseMode);
    const currentPhase = phaseObj.key;
    const isArchive = topicData?.status === 'archived' || topicData?.type === 'archive';
    const isVotingPhase = ["voting", "blackout", "public"].includes(currentPhase);
    const isDiscussionPhase = currentPhase === "discussion";
    const isPublicPhase = currentPhase === "public";
    const isBlackoutPhase = currentPhase === "blackout";
    const hasVoted = !!voteChoice;
    const showResults = isArchive || (hasVoted && !isBlackoutPhase);
    const showDetailCounts = isArchive || isPublicPhase || isDiscussionPhase;
    const safeVotes = votes || {};
    const totalVotes = Object.values(safeVotes).reduce((a, b) => a + b, 0);

    // 表示用の合計
    const displayTotalVotes = (isArchive || showDetailCounts)
        ? totalVotes
        : (voteChoice ? safeVotes[voteChoice] || 0 : 0);

    const getOption = (optId: string | null | undefined) => topicData?.options?.find(o => o.id === optId);

    // パーセンテージ計算のヘルパー関数
    // 画面（JSX）の方でパーセントを表示する際、この関数を使うと「0で割るエラー」を防げます
    const getVotePercentage = (count: number | undefined) => {
        if (!count || totalVotes === 0) return 0;
        return ((count / totalVotes) * 100);
    };

    // --- Vote & Submit Actions ---
    const handleVote = async (choiceId: string) => {
        if (isArchive) return;
        const option = getOption(choiceId);
        if (!option) return;
        if (hasVoted && !requireReason) {
            if (voteChoice === choiceId) return;
            setRequireReason(true);
            setTempReVoteChoice(choiceId);
            showToast(`「${option.text}」へ変更するには理由が必要です`, "info");
            return;
        }
        if (!confirm(isDiscussionPhase ? `「${option.text}」派として参加しますか？` : `「${option.text}」に投票しますか？`)) return;

        try {
            const batch = writeBatch(db);
            batch.set(doc(db, "topic_votes", id), { [userId]: choiceId }, { merge: true });
            const topicRef = doc(db, "topics", id);

            if (voteChoice && voteChoice !== choiceId) {
                // 変更の場合
                batch.update(topicRef, {
                    [`votes.${voteChoice}`]: increment(-1),
                    [`votes.${choiceId}`]: increment(1),
                    votedUserIds: arrayUnion(userId) // 念のためここにも追加
                });
            } else {
                // 新規投票の場合
                batch.update(topicRef, {
                    [`votes.${choiceId}`]: increment(1),
                    votedUserIds: arrayUnion(userId) // ★IDリストに自分を追加
                });
            }

            await batch.commit();
            setVoteChoice(choiceId);
            if (!requireReason) showToast("投票しました！");
        } catch (e) {
            console.error(e);
            showToast(`エラーが発生しました: ${(e as Error).message}`, "error");
        }
    };

    const submitReason = async () => {
        if (isSubmitting) return;
        if (requireReason && !tempReVoteChoice) return showToast("選択肢を選んでください", "error");
        if (!reason.trim()) return showToast("理由を入力してください", "error");
        if (!checkCooldown()) return;

        const targetOptionId = requireReason ? tempReVoteChoice : voteChoice;
        if (!targetOptionId) return showToast("エラー", "error");
        setIsSubmitting(true);

        try {
            const myOldReasons: any[] = [];
            Object.values(reasons).forEach(list => list.forEach((r: any) => { if (r.userId === userId) myOldReasons.push(r); }));
            for (const r of myOldReasons) if (r.id) await deleteDoc(doc(db, "topics", id, "reasons", r.id));

            const newReason = {
                text: reason.trim(),
                timestamp: new Date().toISOString(),
                userId: userId,
                isReVoter: isReVoter || requireReason,
                likes: 0,
                likedBy: [],
                reports: 0,
                isHidden: false,
                voteOptionId: targetOptionId
            };
            await setDoc(doc(db, "topics", id, "reasons", `${userId}_${Date.now()}`), newReason);

            if (requireReason) {
                const batch = writeBatch(db);
                batch.set(doc(db, "topic_votes", id), { [userId]: targetOptionId }, { merge: true });
                batch.set(doc(db, "topic_revoters", id), {
                    [userId]: {
                        isReVoter: true,
                        updatedAt: new Date().toISOString()
                    }
                }, { merge: true });
                const topicRef = doc(db, "topics", id);
                if (voteChoice) {
                    batch.update(topicRef, {
                        [`votes.${voteChoice}`]: increment(-1),
                        [`votes.${targetOptionId}`]: increment(1),
                        votedUserIds: arrayUnion(userId)
                    });
                } else {
                    batch.update(topicRef, {
                        [`votes.${targetOptionId}`]: increment(1),
                        votedUserIds: arrayUnion(userId)
                    });
                }
                await batch.commit();
                setRawRevoteData({
                    isRevote: true,
                    updatedAt: Date.now()
                });
                setRequireReason(false);
                setTempReVoteChoice(null);
                setVoteChoice(targetOptionId);
                showToast("再投票しました", "success");
            } else showToast("理由を投稿しました", "success");
            updateLastPostTime();
            setReason("");
        } catch (e) { showToast("エラー", "error"); }
        finally { setIsSubmitting(false); }
    };

    const handleComment = async () => {
        if (isSubmitting) return;
        if (!newComment.trim()) return showToast("入力してください", "error");
        if (!hasVoted) return showToast("投票が必要です", "error");
        if (!checkCooldown()) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(db, "topics", id, "comments", `c_${Date.now()}`), {
                text: newComment.trim(),
                timestamp: new Date().toLocaleString(),
                userId: userId,
                userVoteChoice: voteChoice,
                isReVoter: isReVoter,
                reports: 0,
                isHidden: false,
                quoteNumber: quoteNumber || null,
                phase: isDiscussionPhase ? 'discussion' : 'voting',
                likedUserIds: [], likeCount: 0
            });
            updateLastPostTime();
            setNewComment("");
            setQuoteNumber(null);
            showToast("投稿しました");
        } catch (e) { showToast("エラー", "error"); }
        finally { setIsSubmitting(false); }
    };

    const handleQuoteClick = (num: number) => {
        setQuoteNumber(num);
        commentInputRef.current?.focus();
    };

    // --- 表示ロジック（★賢いソート機能） ---

    // ソート・結合ロジック
    // 「上位3件」は常にいいね順。「残り」だけがソート順の影響を受ける。
    const getSmartSortedList = (list: any[]) => {
        // 隠しフラグがtrue、または「通報数が10以上」なら除外する
        const valid = list.filter(r => !r.isHidden && (r.reports || 0) < 10);

        // 1. まず全件を「いいね順」でソートして、真のTOP3を抽出
        const sortedByLikes = [...valid].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        const top3 = sortedByLikes.slice(0, 3);
        const top3Ids = new Set(top3.map(r => r.id));

        // 2. 残りのアイテムを抽出
        let rest = valid.filter(r => !top3Ids.has(r.id));

        // 3. 残りのアイテムだけをユーザー指定の順序でソート
        if (sortBy === 'newest') {
            rest.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else {
            // いいね順 (restもいいね順)
            rest.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        }

        // 4. 合体 (上位3件 + ソートされた残り)
        return [...top3, ...rest];
    };

    // 掲示板フィルタリング
    const currentCommentList = useMemo(() => {
        // 隠しフラグがTrue、または「通報数が10以上」なら除外する
        let list = comments.filter(c => !c.isHidden && (c.reports || 0) < 10);

        const getPhase = (c: any) => c.phase || 'voting';
        if (isArchive) {
            if (activeBoardTab === 'discussion') list = list.filter(c => getPhase(c) === 'discussion');
            else list = list.filter(c => c.userVoteChoice === activeBoardTab && getPhase(c) === 'voting');
        } else if (isDiscussionPhase) {
            list = list.filter(c => getPhase(c) === 'discussion');
        } else if (isVotingPhase && voteChoice) {
            list = list.filter(c => c.userVoteChoice === voteChoice && getPhase(c) !== 'discussion');
        }
        return list;
    }, [comments, isArchive, activeBoardTab, isVotingPhase, voteChoice, isDiscussionPhase]);

    // 掲示板ページネーション (動的itemsPerPage)
    const totalPages = Math.ceil(currentCommentList.length / itemsPerPage);

    // ページ数が減ったときに範囲外に行かないように調整
    useEffect(() => {
        if (commentPage > totalPages && totalPages > 0) {
            setCommentPage(1);
        }
    }, [itemsPerPage, totalPages, commentPage]);

    const displayedComments = currentCommentList.slice((commentPage - 1) * itemsPerPage, commentPage * itemsPerPage);
    const getCommentNumber = (index: number) => (commentPage - 1) * itemsPerPage + index + 1;

    // スマートページネーションの計算
    const getPaginationRange = () => {
        const delta = 2; // 現在ページの前後に表示する数
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= commentPage - delta && i <= commentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }
        return rangeWithDots;
    };

    // 理由カード描画
    const renderReasonCard = (r: any, idx: number) => {
        const option = getOption(r.voteOptionId);
        const optIndex = topicData?.options?.findIndex(o => o.id === r.voteOptionId) ?? 0;
        const textColor = optIndex >= 0 ? OPTION_TEXT_COLORS[optIndex % OPTION_TEXT_COLORS.length] : "text-gray-700";

        // ★Top3判定 (上位3件は常にTop3として扱う)
        const isTop3 = idx < 3;

        return (
            <div key={r.id || idx} className={`p-3 border rounded-xl bg-white shadow-sm mb-3 ${isTop3 ? 'border-yellow-400 ring-4 ring-yellow-50 bg-yellow-50' : ''}`}>
                {isTop3 && <div className="text-[10px] font-black text-yellow-600 mb-1 flex items-center gap-1">
                    👑 第{idx + 1}位
                </div>}
                <div className={`text-xs font-bold ${textColor} mb-1 flex items-center gap-2`}>
                    <span>
                        {option?.text}派の意見
                    </span>
                    {/* 再投票フラグがあればマークを表示 */}
                    {r.isReVoter && (
                        <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[9px] border border-orange-200">
                            🔄再
                        </span>
                    )}
                </div>
                <div className="text-sm text-gray-800 mb-2">{r.text}</div>
                <div className="flex justify-between items-center border-t pt-2 border-gray-100">
                    <div className="text-[10px] text-gray-400">
                        {new Date(r.timestamp).toLocaleDateString()} {r.userId === userId && "(自分)"}
                    </div>
                    <button onClick={() => handleLikeReason(r.id, r.likedUserIds || [])} className="text-xs flex items-center gap-1 text-gray-500 hover:text-pink-500">
                        {(r.likedUserIds || []).includes(userId) ? "❤️" : "🤍"} <span className="font-bold">{r.likeCount || 0}</span>
                    </button>
                    {userId !== r.userId && !reportedIds.has(r.id) && (
                        <button
                            onClick={() => handleReportReason(r.id, r.userId)}
                            className="text-[10px] text-gray-300 hover:text-red-500"
                        >
                            通報
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // 1. 本当に読み込み中のとき
    if (loading) {
        return <div className="p-20 text-center font-bold text-gray-500">
            データを読み込んでいます...
        </div>;
    }

    // 2. 読み込みは終わったが、データがないとき（ID間違いなど）
    if (!topicData) {
        return (
            <div className="p-20 text-center font-bold text-red-500">
                お題が見つかりませんでした。<br />
                <button onClick={() => router.push("/")} className="mt-4 px-4 py-2 bg-gray-200 rounded">
                    トップへ戻る
                </button>
            </div>
        );
    }

    // 3. ここまで来たらデータはある！
    // 閲覧権限を「アーカイブ または 投票済み」のみに限定（フェーズによる緩和を削除）
    // これにより、未投票なら何曜日だろうと絶対に見れなくなります
    const canViewContent = hasVoted || isArchive;

    // この時点では topicData が必ずあることが保証されているのでエラーになりません
    if (!isArchive && topicData.startDate && new Date(topicData.startDate) > now) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-lg border-2 border-orange-200 mx-4">
                    <div className="text-6xl mb-6">
                        ⏳
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 mb-4">
                        公開までお待ちください
                    </h1>
                    <p className="text-gray-500 mb-6">
                        このお題はまだ開始されていません。<br />
                        公開予定時刻までしばらくお待ちください。
                    </p>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 inline-block text-left mb-8">
                        <p className="text-xs font-bold text-orange-400 mb-1">
                            タイトル
                        </p>
                        <p className="font-bold text-gray-800 text-lg mb-2">
                            {topicData.title}</p>
                        <p className="text-xs font-bold text-orange-400 mb-1">
                            開始予定
                        </p>
                        <p className="font-mono font-bold text-orange-600 text-xl">
                            {new Date(topicData.startDate).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <button onClick={() => router.push("/")} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-gray-600 transition">
                            トップへ戻る
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. メイン画面の描画
    return (
        <div className="flex justify-center bg-gray-50 min-h-screen">
            <Toast
                message={toast?.message || ""}
                type={toast?.type}
                onClose={() => setToast(null)}
            />

            {/* PC用広告枠 1 */}
            <aside className="hidden lg:block w-[180px] shrink-0">
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/e77aea49d12922305913e6419e4939aa"
                        width={160}
                        height={600}
                    />
                </div>
                {/* PC用広告枠 2 */}
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/a287941cdd4183dec10c34c074a30e51"
                        width={160}
                        height={600}
                    />
                </div>
                {/* PC用広告枠 3 */}
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/407eb6db022264376b4667f8d071b0f9"
                        width={160}
                        height={600}
                    />
                </div>
            </aside>
            <main className="w-full max-w-4xl p-6 bg-white shadow-sm">

                {/* Header (戻るボタンなど) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold transition"
                    >
                        ← 戻る
                    </button>

                    {/* スマホでは右端に配置、PCではそのまま横並びにするためのラッパー */}
                    <div className="self-end md:self-auto">
                        <ShareButtons
                            title={topicData.title}
                            options={topicData.options}   // ★選択肢を渡す
                            topicId={topicData.topicId}   // ★IDを渡して、正しいURLを作らせる
                            votes={votes}
                            showStats={showDetailCounts}
                        />
                    </div>
                </div>

                {/* スマホ用広告枠 1 */}
                <div className="block lg:hidden w-full flex justify-center mb-8">
                    <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/o/79e5c7652f56529ba7bc98a949774b7d"
                            width={300}
                            height={250}
                        />
                    </div>
                </div>

                {/* フェーズ表示バッジ */}
                <div className="mb-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${currentPhase === 'voting' ? 'bg-blue-500' :
                        currentPhase === 'discussion' ? 'bg-green-500' :
                            currentPhase === 'public' ? 'bg-orange-500' : 'bg-gray-500'
                        }`}>
                        {currentPhase === 'voting' ? '🗳️ 投票フェーズ' :
                            currentPhase === 'discussion' ? '🗣️ 議論フェーズ' :
                                currentPhase === 'public' ? '📊 結果公開フェーズ' : '🔒 準備期間'}
                    </span>
                </div>

                <h1 className="text-2xl font-black mb-2">
                    {topicData.title}
                </h1>
                <p className="text-gray-500 italic mb-8 border-l-4 border-blue-500 pl-4">
                    {topicData.description}
                </p>
                {isArchive &&
                    <div className="p-3 bg-gray-200 text-gray-700 rounded-lg font-semibold mb-4"
                    >
                        ⚠️ アーカイブ済みです
                    </div>
                }

                {/* --- 投票エリア --- */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4">
                        🗳️ 投票
                    </h2>
                    {!requireReason && (
                        <div className="flex gap-3 flex-wrap">
                            {topicData.options?.map((opt, i) => (
                                <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={isArchive || (hasVoted && !requireReason)}
                                    className={`px-6 py-3 text-white font-bold rounded-xl transition shadow-md 
                                    ${BUTTON_COLORS[i % BUTTON_COLORS.length]} 
                                    ${voteChoice === opt.id ? COLORS.VOTED_ACTIVE : ''} 
                                    ${((hasVoted && !requireReason && voteChoice !== opt.id) || (isArchive && voteChoice !== opt.id)) ? 'opacity-30' : ''}`}>
                                    {opt.prefix} {opt.text}
                                </button>
                            ))}
                            {hasVoted && !isReVoter && !isArchive && !requireReason && (
                                <button
                                    onClick={() => { setRequireReason(true); setTempReVoteChoice(null); }}
                                    className={`px-6 py-3 ${COLORS.REVOTE_BUTTON} text-white font-bold rounded-xl shadow-md`}
                                >
                                    🔄 再投票
                                </button>
                            )}
                        </div>
                    )}
                    {requireReason && (
                        <div className="mt-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                            <p className="font-bold text-orange-800 mb-2">
                                変更先の選択肢を選び、理由を入力してください
                            </p>
                            <div className="flex gap-2 mb-3">
                                {topicData.options?.map((opt, i) => {
                                    const isOldChoice = opt.id === voteChoice;
                                    const isTempSelected = tempReVoteChoice === opt.id;
                                    let opacityClass = isOldChoice ? 'opacity-30 cursor-not-allowed' : (tempReVoteChoice && !isTempSelected ? 'opacity-50 hover:opacity-100' : '');
                                    return (
                                        <button key={opt.id} onClick={() => setTempReVoteChoice(opt.id)} disabled={isOldChoice}
                                            className={`px-4 py-2 rounded-lg text-white text-sm font-bold transition shadow-sm 
                                    ${BUTTON_COLORS[i % BUTTON_COLORS.length]} 
                                    ${isTempSelected ? COLORS.VOTED_ACTIVE : ''} ${opacityClass}`}>
                                            {opt.text} {isOldChoice && "(現在)"}
                                        </button>
                                    );
                                })}
                            </div>
                            {tempReVoteChoice && (
                                <div className="relative">
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        className="w-full p-3 border rounded-lg mb-1"
                                        maxLength={MAX_REASON_LENGTH}
                                        placeholder="理由を入力..."
                                    />
                                    <span
                                        className="absolute bottom-2 right-2 text-xs text-gray-400">
                                        {reason.length}/{MAX_REASON_LENGTH}
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={submitReason}
                                    disabled={!tempReVoteChoice || isSubmitting}
                                    className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg shadow disabled:opacity-50"
                                >
                                    {isSubmitting ? '送信中...' : '確定'}
                                </button>
                                <button
                                    onClick={() => { setRequireReason(false); setReason(""); setTempReVoteChoice(null); }}
                                    className="px-4 py-2 bg-gray-300 font-bold rounded-lg"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    )}

                    {showResults ? (
                        <div className="mt-8 p-6 bg-gray-50 border rounded-2xl shadow-inner">
                            <h3 className="font-black text-gray-700 mb-4">
                                投票状況 (合計 {displayTotalVotes} 票)
                            </h3>
                            <div className="space-y-4">
                                {topicData.options?.map((opt, i) => {
                                    const count = votes[opt.id] || 0;
                                    const pct = Math.round(getVotePercentage(count));
                                    const isVisible = showDetailCounts || voteChoice === opt.id;
                                    return (
                                        <div key={opt.id}>
                                            <div className="flex justify-between text-sm font-bold mb-1">
                                                <span className={OPTION_TEXT_COLORS[i % 5]}>
                                                    {opt.text}
                                                </span>
                                                <span className="text-gray-500">
                                                    {isVisible ? `${pct}% ${showDetailCounts ? `(${count}票)` : ''}` : '??? %'}
                                                </span>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    style={{ width: isVisible ? `${pct}%` : '0%' }}
                                                    className={`h-full transition-all duration-1000 ${OPTION_BG_COLORS[i % 5]}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* 結果が見えていない場合 */
                        hasVoted ? (
                            /* ケースA: 投票済みだが、集計期間（ブラックアウト）で見れない */
                            <div className="mt-4 p-4 border bg-gray-50 text-center text-sm text-gray-500 rounded-xl">
                                結果は公開期間まで非表示です（戦場の霧）
                            </div>
                        ) : (
                            /* ケースB: 未投票だから見れない */
                            <div className="mt-8 p-6 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl text-center">
                                <p className="text-lg font-bold text-gray-600 mb-2">
                                    🔒 結果は非表示です
                                </p>
                                <p className="text-sm text-gray-500">
                                    投票に参加すると<br />みんなの回答が見られます
                                </p>
                            </div>
                        )
                    )}
                </section>
                <hr className="my-8" />

                {/* コンテンツロック（理由＆掲示板） */}
                {/* コンテンツロック機能：未投票ならロック画面、投票済みなら中身を表示 */}
                {!canViewContent ? (
                    /* A. 見ちゃダメな場合（ロック画面を表示） */
                    <div className="py-12 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 text-center animate-in fade-in">
                        <div className="text-4xl mb-4">
                            🔒
                        </div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">
                            投票すると閲覧できます
                        </h3>
                        <p className="text-gray-500 text-sm">
                            「みんなの理由」と「掲示板」を見るには、<br />
                            まずはあなたの意見を投票してください！
                        </p>
                    </div>
                ) : (
                    /* B. 見てOKな場合（理由エリアと掲示板エリアをここにまとめた） */
                    <>
                        {/* --- 理由エリア --- */}
                        <section className="mb-12">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">
                                    💬 みんなの理由
                                </h2>
                                {/* 並び替えボタン (折りたたみ部分に適用) */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSortBy('likes')}
                                        className={`text-xs px-2 py-1 rounded border ${sortBy === 'likes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        いいね順
                                    </button>
                                    <button
                                        onClick={() => setSortBy('newest')}
                                        className={`text-xs px-2 py-1 rounded border ${sortBy === 'newest' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        新着順
                                    </button>
                                </div>
                            </div>

                            {!isArchive && hasVoted && isVotingPhase && !requireReason && (
                                <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                    <p className="text-sm font-bold text-blue-800 mb-2"
                                    >
                                        {getOption(voteChoice)?.text}
                                        派として理由を投稿
                                    </p>
                                    <div className="relative">
                                        <textarea
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="w-full p-3 border rounded-lg mb-2"
                                            placeholder="なぜその選択肢を選びましたか？(任意)"
                                            maxLength={MAX_REASON_LENGTH}
                                        />
                                        <span
                                            className="absolute bottom-4 right-2 text-xs text-gray-400"
                                        >
                                            {reason.length}/{MAX_REASON_LENGTH}
                                        </span>
                                    </div>
                                    <button
                                        onClick={submitReason}
                                        disabled={isSubmitting}
                                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {isSubmitting ? '投稿中...' : '投稿・上書き'}
                                    </button>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* パターンA: 議論フェーズ or アーカイブ (左右分割・陣営別表示) */}
                                {(isDiscussionPhase || isArchive) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {topicData.options?.map((opt, i) => {
                                            // ★賢いリスト取得 (Top3固定 + 残りソート)
                                            const smartList = getSmartSortedList(reasons[opt.id] || []);
                                            // 折りたたみ判定
                                            const displayList = isReasonsExpanded ? smartList : smartList.slice(0, 3);

                                            return (
                                                <div key={opt.id} className="bg-gray-50 p-3 rounded-2xl border">
                                                    <h3 className={`font-bold text-center mb-3 pb-2 border-b ${OPTION_TEXT_COLORS[i % 5]}`}>
                                                        {opt.text} 派の主張
                                                    </h3>
                                                    {displayList.length > 0 ? (
                                                        displayList.map((r, idx) => renderReasonCard(r, idx))
                                                    ) : <p className="text-xs text-gray-400 text-center py-4">
                                                        まだ投稿がありません
                                                    </p>}
                                                    {!isReasonsExpanded && smartList.length > 3 && (
                                                        <p className="text-center text-xs text-gray-400 mt-2">
                                                            他 {smartList.length - 3} 件
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* パターンB: 投票フェーズ (自分の陣営のみ表示) */}
                                {!isDiscussionPhase && !isArchive && voteChoice && (
                                    <div>
                                        <h3 className="font-bold text-gray-700 mb-3">
                                            あなたと同じ {getOption(voteChoice)?.text} 派の意見
                                        </h3>
                                        {(() => {
                                            const smartList = getSmartSortedList(reasons[voteChoice] || []);
                                            const displayList = isReasonsExpanded ? smartList : smartList.slice(0, 3);
                                            return (
                                                <>
                                                    {displayList.map((r, idx) => renderReasonCard(r, idx))}
                                                    {smartList.length === 0 && <p className="text-gray-500">まだ理由がありません。</p>}
                                                    {!isReasonsExpanded && smartList.length > 3 && <p className="text-center text-xs text-gray-400 mt-2">他 {smartList.length - 3} 件</p>}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                <div className="text-center mt-4">
                                    <button
                                        onClick={() => setIsReasonsExpanded(!isReasonsExpanded)}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-6 rounded-full text-sm transition"
                                    >
                                        {isReasonsExpanded ? "▲ 折りたたむ" : "▼ 全ての理由を見る"}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* スマホ用広告枠 2 */}
                        <div className="block lg:hidden w-full flex justify-center my-6">
                            <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                                <NinjaAdMax
                                    src="https://adm.shinobi.jp/o/601fb4b7c03373cde9608f8b31078c09"
                                    width={300}
                                    height={250}
                                />
                            </div>
                        </div>

                        <hr className="my-8" />

                        {/* --- 掲示板エリア (ページ切り替え対応) --- */}
                        <section className="pb-20">
                            {/* ヘッダーに件数セレクター */}
                            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-2">
                                <h2 className="text-xl font-bold">
                                    {isDiscussionPhase || isArchive ? "🗣️ 議論掲示板" : "🔒 陣営別掲示板"}
                                </h2>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-500 font-bold text-xs">
                                        表示件数:
                                    </span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCommentPage(1); // 件数を変えたら1ページ目に戻す
                                        }}
                                        className="border border-gray-300 rounded p-1 bg-white text-gray-700 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
                                    >
                                        <option value={20}>20件</option>
                                        <option value={50}>50件</option>
                                        <option value={100}>100件</option>
                                    </select>
                                </div>
                            </div>

                            {isArchive && (
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                    <button
                                        onClick={() => { setActiveBoardTab('discussion'); setCommentPage(1); }}
                                        className={`px-3 py-1 rounded-full text-sm font-bold ${activeBoardTab === 'discussion' ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE}`}
                                    >
                                        議論全体
                                    </button>
                                    {topicData.options?.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setActiveBoardTab(opt.id); setCommentPage(1); }}
                                            className={`px-3 py-1 rounded-full text-sm font-bold ${activeBoardTab === opt.id ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE}`}
                                        >
                                            {opt.text}派
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!isArchive && isVotingPhase && voteChoice && <p
                                className="text-sm text-blue-600 font-bold mb-4 bg-blue-50 p-2 rounded"
                            >
                                ※ 投票フェーズ中は、自陣営のコメントのみ表示されます
                            </p>}

                            <div className="space-y-2 mb-6 max-h-[800px] overflow-y-auto pr-2">
                                {displayedComments.map((c, i) => (
                                    <div key={(c as any).id || i} className="p-3 bg-gray-50 border rounded-lg hover:bg-white transition">
                                        <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                                            <span
                                                className="flex items-center gap-1">No.{getCommentNumber(i)} | {getOption(c.userVoteChoice)?.text}派 {c.isReVoter &&
                                                    <span className="bg-orange-100 text-orange-600 px-1 rounded text-[9px]">
                                                        🔄再
                                                    </span>}
                                                {ADMIN_UIDS.includes((c as any).userId) && (
                                                    <span className="ml-1 bg-gray-900 text-yellow-400 border border-yellow-500 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 shadow-sm">
                                                        <span>👑</span> 運営
                                                    </span>
                                                )}
                                            </span>
                                            <span>{c.timestamp}</span>
                                        </div>
                                        {c.quoteNumber &&
                                            <div
                                                className="text-[10px] bg-gray-200 border-l-4 border-gray-400 pl-2 py-1 mb-2 text-gray-600 italic">
                                                No.{c.quoteNumber} への返信
                                            </div>}
                                        <p className="text-sm text-gray-800 leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
                                        {!isArchive && (
                                            <div className="flex justify-end gap-3 mt-1 items-center">
                                                <button
                                                    onClick={() => handleLikeComment((c as any).id, (c as any).likedUserIds || [])}
                                                    className="text-[10px] text-gray-400 hover:text-pink-500 flex items-center gap-1 transition">
                                                    {(c as any).likedUserIds?.includes(userId) ? '❤️' : '🤍'} {(c as any).likeCount || 0}
                                                </button>
                                                <button
                                                    onClick={() => handleQuoteClick(getCommentNumber(i))}
                                                    className="text-[10px] text-blue-500 font-bold hover:underline">
                                                    返信
                                                </button>
                                                {userId !== (c as any).userId && !reportedIds.has((c as any).id) && (
                                                    <button
                                                        onClick={() => handleReportComment(c)}
                                                        className="text-[10px] text-gray-400 hover:text-red-500 underline decoration-gray-400">
                                                        通報
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {displayedComments.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">コメントはありません</p>}
                            </div>

                            {/* スマートページネーション */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-1 flex-wrap bg-gray-100 p-3 rounded-lg mt-4 mb-4">
                                    <button
                                        disabled={commentPage === 1}
                                        onClick={() => setCommentPage(p => Math.max(1, p - 1))}
                                        className="px-3 py-1 bg-white border rounded shadow-sm disabled:opacity-30 hover:bg-gray-50 font-bold text-sm"
                                    >
                                        ←
                                    </button>

                                    {getPaginationRange().map((page, index) => (
                                        page === '...' ? (
                                            <span key={`dots-${index}`} className="px-2 text-gray-400">...</span>
                                        ) : (
                                            <button
                                                key={`page-${page}`}
                                                onClick={() => setCommentPage(Number(page))}
                                                className={`min-w-[32px] h-8 flex items-center justify-center rounded border text-sm font-bold transition
                                                    ${commentPage === page
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    ))}

                                    <button
                                        disabled={commentPage === totalPages}
                                        onClick={() => setCommentPage(p => Math.min(totalPages, p + 1))}
                                        className="px-3 py-1 bg-white border rounded shadow-sm disabled:opacity-30 hover:bg-gray-50 font-bold text-sm"
                                    >
                                        →
                                    </button>
                                </div>
                            )}

                            {!isArchive && hasVoted && (
                                <div className="p-4 bg-white border-2 border-gray-200 rounded-2xl shadow-lg">
                                    {quoteNumber && <div className="text-xs bg-yellow-100 p-2 rounded mb-2 flex justify-between items-center">
                                        <span>
                                            No.{quoteNumber} を引用中
                                        </span>
                                        <button
                                            onClick={() => setQuoteNumber(null)}
                                            className="text-red-500 font-bold">
                                            解除
                                        </button>
                                    </div>}
                                    <div className="relative">
                                        <textarea
                                            ref={commentInputRef}
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            className="w-full p-3 border rounded-xl mb-2 focus:ring-2 focus:ring-blue-500"
                                            placeholder="コメントを入力..."
                                            maxLength={MAX_COMMENT_LENGTH}
                                        />
                                        <span
                                            className="absolute bottom-4 right-2 text-xs text-gray-400">
                                            {newComment.length}/{MAX_COMMENT_LENGTH}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleComment}
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition shadow-lg disabled:opacity-50">
                                        {isSubmitting ? '送信中...' : 'コメントを送信'}
                                    </button>
                                </div>
                            )}
                            {/* スマホ用広告枠 3 */}
                            <div className="block lg:hidden w-full flex justify-center my-6">
                                <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                                    <NinjaAdMax
                                        src="https://adm.shinobi.jp/o/dbbbbf7922c46dc509b793f92b63677b"
                                        width={300}
                                        height={250}
                                    />
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </main>

            <aside className="hidden lg:block w-[180px] shrink-0">
                {/* PC用広告枠 4 */}
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/f92bbd2f86c40783fa5a7213e45722a4"
                        width={160}
                        height={600}
                    />
                </div>
                {/* PC用広告枠 5 */}
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/ade2552d9fac5abbb483d31797ed2714"
                        width={160}
                        height={600}
                    />
                </div>
                {/* PC用広告枠 6 */}
                <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                    <p className="text-xs text-gray-400 mb-1">PR</p>
                    <NinjaAdMax
                        src="https://adm.shinobi.jp/s/8682aec28920821ed143407e8661e1e3"
                        width={160}
                        height={600}
                    />
                </div>
            </aside>
        </div>
    );
}