"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

// Firebase
import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getFirestore, collection, doc, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy,
    increment, writeBatch, arrayUnion, arrayRemove
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";

// Components & Types
import ShareButtons from "@/app/components/ShareButtons";
import Toast from "@/app/components/Toast";
import {
    Reason, Reasons, Comment,
    DynamicTopicData, Option
} from "@/app/dynamic_topic";

// --- Firebase Init ---
const firebaseConfig = {
    apiKey: "AIzaSyCscPYtFlF1FugQT3Q2lbgido5tB1v8nCc",
    authDomain: "odorio-app.firebaseapp.com",
    projectId: "odorio-app",
    storageBucket: "odorio-app.firebasestorage.app",
    messagingSenderId: "932847712539",
    appId: "1:932847712539:web:56d1d246e2ab77c3debbbe",
    measurementId: "G-TS0RJSCYCR"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);


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

const OPTION_BG_COLORS = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];
const OPTION_TEXT_COLORS = ["text-blue-600", "text-purple-600", "text-green-600", "text-yellow-600", "text-red-600"];

const MAX_REASON_LENGTH = 100;
const MAX_COMMENT_LENGTH = 200;
const COMMENTS_PER_PAGE = 100;

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

export default function TopicDetail() {
    const params = useParams();
    const id = params?.id as string; // ここで受け取るIDは既にデコードされている場合が多いですが、念のため
    const router = useRouter();
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    // --- States ---
    const [loading, setLoading] = useState(true);
    const [topicData, setTopicData] = useState<DynamicTopicData | null>(null);
    const [now, setNow] = useState<Date>(new Date());
    const [phaseMode, setPhaseMode] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>("");

    // 自分の投票状態
    const [voteChoice, setVoteChoice] = useState<string | null>(null);
    const [isReVoter, setIsReVoter] = useState(false);

    // データ群
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [reasons, setReasons] = useState<Reasons>({});
    const [comments, setComments] = useState<Comment[]>([]);

    // UI States
    const [reason, setReason] = useState("");
    const [newComment, setNewComment] = useState("");
    const [requireReason, setRequireReason] = useState(false);
    const [tempReVoteChoice, setTempReVoteChoice] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"newest" | "likes">("newest");
    const [activeReasonTab, setActiveReasonTab] = useState<string>('all');
    const [activeBoardTab, setActiveBoardTab] = useState<string>('discussion');
    const [quoteNumber, setQuoteNumber] = useState<number | null>(null);
    const [commentPage, setCommentPage] = useState(1);
    const [showOtherReasons, setShowOtherReasons] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // ★通報済み管理 (理由・コメント共通)
    const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        setToast({ message, type });
    };

    // --- Actions ---

    // 理由へのいいね
    const handleLikeReason = async (reasonId: string | undefined, likedUserIds: string[]) => {
        if (!reasonId) return;
        if (!userId) return showToast("いいねするにはログインが必要です", "error");

        const isLiked = likedUserIds.includes(userId);
        const ref = doc(db, "topics", id, "reasons", reasonId);

        try {
            if (isLiked) {
                await updateDoc(ref, {
                    likedUserIds: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                await updateDoc(ref, {
                    likedUserIds: arrayUnion(userId),
                    likeCount: increment(1)
                });
            }
        } catch (e) { console.error(e); }
    };

    // 理由への通報
    const handleReportReason = async (reasonId: string | undefined, reasonUserId: string) => {
        if (!reasonId) return;
        if (userId === reasonUserId) return; // 自分は通報不可
        if (!confirm("不適切な投稿として通報しますか？\n（通報後は非表示になります）")) return;

        try {
            const ref = doc(db, "topics", id, "reasons", reasonId);
            await updateDoc(ref, { reports: increment(1) });
            setReportedIds(prev => new Set(prev).add(reasonId));
            showToast("通報を受け付けました", "info");
        } catch (e) { showToast("エラーが発生しました", "error"); }
    };

    // コメントへのいいね
    const handleLikeComment = async (commentId: string, likedUserIds: string[]) => {
        if (!userId) return showToast("いいねするにはログインが必要です", "error");
        const isLiked = likedUserIds.includes(userId);
        const ref = doc(db, "topics", id, "comments", commentId);
        try {
            if (isLiked) {
                await updateDoc(ref, { likedUserIds: arrayRemove(userId), likeCount: increment(-1) });
            } else {
                await updateDoc(ref, { likedUserIds: arrayUnion(userId), likeCount: increment(1) });
            }
        } catch (e) { console.error(e); }
    };

    // コメントへの通報
    const handleReportComment = async (comment: any) => {
        const commentId = comment.id;
        if (!commentId) return;
        if (!confirm("不適切な投稿として通報しますか？\n（通報後は非表示になります）")) return;
        try {
            const ref = doc(db, "topics", id, "comments", commentId);
            await updateDoc(ref, { reports: increment(1) });
            setReportedIds(prev => new Set(prev).add(commentId));
            showToast("通報を受け付けました", "info");
        } catch (e) { showToast("エラーが発生しました", "error"); }
    };

    // 理由アイテムのレンダリング関数 (コンポーネント内に移動)
    const renderReasonItem = (r: any, i: number, isArchive: boolean) => {
        if (r.isHidden) return null;

        const likedUserIds = r.likedUserIds || [];
        const likeCount = r.likeCount || 0;
        const reasonId = r.id;

        const option = getOption(r.voteOptionId);
        const optIndex = topicData?.options?.findIndex(o => o.id === r.voteOptionId) ?? 0;
        const textColor = optIndex >= 0 ? OPTION_TEXT_COLORS[optIndex % OPTION_TEXT_COLORS.length] : "text-gray-700";

        return (
            <li key={reasonId || i} className="p-3 border rounded-lg bg-white shadow-sm list-none animate-in fade-in slide-in-from-left-1">
                <p className={`text-sm font-bold ${textColor} mb-1`}>
                    {option?.prefix} {option?.text} への理由
                </p>
                <div className="mb-2 text-gray-800">
                    {r.text}
                    {r.userId === userId && <span className="text-xs font-normal text-blue-500 ml-2">(自分の投稿)</span>}
                    {r.isReVoter && <span className={`text-xs font-bold ${COLORS.REVOTER_MARK} ml-2 bg-orange-100 px-1 rounded border border-orange-200`}>🔄 再投稿者</span>}
                </div>

                <div className="flex justify-between items-center text-sm mt-2 border-t pt-2">
                    <small className="text-gray-500">{new Date(r.timestamp).toLocaleTimeString()}</small>
                    <div className="flex gap-3 items-center">
                        {/* ❤️ いいねボタン */}
                        <button
                            onClick={() => handleLikeReason(reasonId, likedUserIds)}
                            className="flex items-center gap-1 text-gray-400 hover:text-pink-500 transition disabled:opacity-50"
                            disabled={isArchive}
                        >
                            {likedUserIds.includes(userId) ? '❤️' : '🤍'}
                            <span className="text-xs font-bold">{likeCount}</span>
                        </button>

                        {/* 🚨 通報ボタン（修正箇所：文字色を濃くし、表示条件を追加） */}
                        {userId !== r.userId && !reportedIds.has(reasonId) && (
                            <button
                                onClick={() => handleReportReason(reasonId, r.userId)}
                                className={`text-xs text-gray-400 hover:text-red-500 underline decoration-gray-400 ${isArchive ? 'hidden' : ''}`}
                            >
                                通報
                            </button>
                        )}
                    </div>
                </div>
            </li>
        );
    };

    // --- データ取得 ---
    useEffect(() => {
        let unsubData: (() => void) | undefined;
        let unsubAuth: (() => void) | undefined;

        const subscribeData = (uid: string) => {
            // お題
            const unsubTopic = onSnapshot(doc(db, "topics", id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (!data.votes) data.votes = {};
                    setTopicData({ ...data, topicId: docSnap.id } as unknown as DynamicTopicData);
                } else {
                    setTopicData(null);
                }
                setLoading(false);
            }, () => setLoading(false));

            // Config
            const unsubConfig = onSnapshot(doc(db, "system", "config"), (s) => {
                if (s.exists()) setPhaseMode(s.data().phaseMode || null);
            });

            // 投票状況
            const unsubVotes = onSnapshot(doc(db, "topic_votes", id), (s) => {
                if (s.exists()) {
                    const data = s.data() as Record<string, string>;
                    setVoteChoice(data[uid] || null);
                    const counts: Record<string, number> = {};
                    Object.values(data).forEach(optId => counts[optId] = (counts[optId] || 0) + 1);
                    setVotes(counts);
                }
            });

            // 再投票フラグ
            const unsubReVoter = onSnapshot(doc(db, "topic_revoters", id), (s) => {
                if (s.exists() && s.data()[uid]) setIsReVoter(true);
            });

            // 理由
            const unsubReasons = onSnapshot(query(collection(db, "topics", id, "reasons")), (snap) => {
                const reasonsObj: Reasons = {};
                snap.docs.forEach(d => {
                    const r = d.data() as Reason;
                    // IDといいね情報を結合
                    const reasonWithId = {
                        ...r,
                        id: d.id,
                        likedUserIds: r.likedUserIds || [],
                        likeCount: r.likeCount || 0
                    };
                    if (!reasonsObj[r.voteOptionId]) reasonsObj[r.voteOptionId] = [];
                    reasonsObj[r.voteOptionId].push(reasonWithId);
                });
                setReasons(reasonsObj);
            });

            // コメント
            const unsubComments = onSnapshot(query(collection(db, "topics", id, "comments"), orderBy("timestamp", "asc")), (snap) => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as Comment));
                setComments(list);
            });

            return () => {
                unsubTopic(); unsubConfig(); unsubVotes(); unsubReVoter(); unsubReasons(); unsubComments();
            };
        };

        const initAuth = async () => {
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
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    const displayTotalVotes = (isArchive || showDetailCounts) ? totalVotes : (voteChoice ? votes[voteChoice] || 0 : 0);
    const getOption = (optId: string | null | undefined) => topicData?.options?.find(o => o.id === optId);

    // --- アクション ---
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
        const msg = isDiscussionPhase ? `「${option.text}」派として参加しますか？` : `「${option.text}」に投票しますか？`;
        if (!confirm(msg)) return;

        try {
            const batch = writeBatch(db);
            batch.set(doc(db, "topic_votes", id), { [userId]: choiceId }, { merge: true });
            const topicRef = doc(db, "topics", id);
            if (voteChoice && voteChoice !== choiceId) {
                batch.update(topicRef, { [`votes.${voteChoice}`]: increment(-1), [`votes.${choiceId}`]: increment(1) });
            } else {
                batch.update(topicRef, { [`votes.${choiceId}`]: increment(1) });
            }
            await batch.commit();
            setVoteChoice(choiceId);
            if (!requireReason) showToast("投票しました！");
        } catch (e) { console.error(e); showToast("エラーが発生しました", "error"); }
    };

    const submitReason = async () => {
        if (requireReason && !tempReVoteChoice) return showToast("変更先の選択肢を選択してください", "error");
        if (!reason.trim()) return showToast("理由を入力してください", "error");
        const targetOptionId = requireReason ? tempReVoteChoice : voteChoice;
        if (!targetOptionId) return showToast("投票先が不明です", "error");

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
                batch.set(doc(db, "topic_revoters", id), { [userId]: true }, { merge: true });
                const topicRef = doc(db, "topics", id);
                if (voteChoice) batch.update(topicRef, { [`votes.${voteChoice}`]: increment(-1), [`votes.${targetOptionId}`]: increment(1) });
                else batch.update(topicRef, { [`votes.${targetOptionId}`]: increment(1) });

                await batch.commit();
                setIsReVoter(true);
                setRequireReason(false);
                setTempReVoteChoice(null);
                setVoteChoice(targetOptionId);
                showToast("再投票が完了しました！", "success");
            } else {
                showToast("理由を投稿しました！", "success");
            }
            setReason("");
        } catch (e) { showToast("投稿に失敗しました", "error"); }
    };

    const handleComment = async () => {
        if (!newComment.trim()) return showToast("コメントを入力してください", "error");
        if (!hasVoted) return showToast("コメントには投票が必要です", "error");
        if (isArchive) return showToast("アーカイブ済みです", "error");
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
                likedUserIds: [], // 初期化
                likeCount: 0      // 初期化
            });
            setNewComment("");
            setQuoteNumber(null);
            showToast("コメントを投稿しました！");
        } catch (e) { showToast("投稿失敗", "error"); }
    };

    const handleQuoteClick = (num: number) => {
        setQuoteNumber(num);
        commentInputRef.current?.focus();
    };

    // --- 表示データ計算 ---
    const sortedReasonsMap = useMemo(() => {
        const map: Reasons = {};
        (topicData?.options || []).forEach((opt) => {
            const list = reasons[opt.id] || [];
            const visible = list.filter(r => !r.isHidden);
            map[opt.id] = sortBy === "newest"
                ? [...visible].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                : [...visible].sort((a, b) => ((b.likeCount || 0) - (a.likeCount || 0)));
        });
        return map;
    }, [reasons, sortBy, topicData]);

    const topReasons = useMemo(() => {
        if (isDiscussionPhase || isArchive) {
            let collected: Reason[] = [];
            topicData?.options?.forEach(opt => {
                const list = sortedReasonsMap[opt.id] || [];
                collected = collected.concat([...list].sort((a, b) => ((b.likeCount || 0) - (a.likeCount || 0))).slice(0, 3));
            });
            return collected;
        } else {
            return (sortedReasonsMap[voteChoice!] || []).slice(0, 3);
        }
    }, [sortedReasonsMap, voteChoice, isDiscussionPhase, isArchive, topicData]);

    const otherReasons = useMemo(() => {
        let targetOptionIds: string[] = [];
        if (isDiscussionPhase || isArchive) targetOptionIds = (topicData?.options || []).map(o => o.id);
        else if (voteChoice) targetOptionIds = [voteChoice];
        else return [];

        const currentSortList = targetOptionIds.flatMap(id => sortedReasonsMap[id] || []);
        const topIds = new Set(topReasons.map((r: any) => r.id));
        return currentSortList.filter((r: any) => !topIds.has(r.id));
    }, [sortedReasonsMap, voteChoice, topReasons, isDiscussionPhase, isArchive, topicData]);

    const currentCommentList = useMemo(() => {
        let list = comments.filter(c => !c.isHidden);
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

    const displayCommentCount = currentCommentList.length;
    const startIndex = (commentPage - 1) * COMMENTS_PER_PAGE;
    const displayedComments = currentCommentList.slice(startIndex, startIndex + COMMENTS_PER_PAGE);
    const getCommentNumber = (index: number) => (commentPage - 1) * COMMENTS_PER_PAGE + index + 1;
    const totalPages = Math.ceil(currentCommentList.length / COMMENTS_PER_PAGE);

    if (loading || !topicData) return <div className="p-20 text-center font-bold text-gray-500">データを読み込んでいます...</div>;

    return (
        <div className="flex justify-center bg-gray-50 min-h-screen">
            <Toast message={toast?.message || ""} type={toast?.type} onClose={() => setToast(null)} />
            <div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md">📢 左広告</div>
            <div className="w-full max-w-4xl p-6 bg-white shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold transition">← 戻る</button>
                    <ShareButtons url={typeof window !== "undefined" ? window.location.href : ""} title={topicData.title} />
                </div>
                <div className="lg:hidden w-full bg-gray-100 h-24 mb-6 flex items-center justify-center text-gray-400 text-sm border">[スマホ用広告]</div>
                <h1 className="text-2xl font-black mb-2">{topicData.title}</h1>
                <p className="text-gray-500 italic mb-8 border-l-4 border-blue-500 pl-4">{topicData.description}</p>
                {isArchive && <div className="p-3 bg-gray-200 text-gray-700 rounded-lg font-semibold mb-4">⚠️ アーカイブ済みです</div>}

                {/* 投票エリア */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        🗳️ 投票 {voteChoice && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">選択中: {getOption(voteChoice)?.text}</span>}
                    </h2>
                    {!requireReason && (
                        <div className="flex gap-3 flex-wrap">
                            {topicData.options?.map((opt, i) => (
                                <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={isArchive || (hasVoted && !requireReason)} className={`px-6 py-3 text-white font-bold rounded-xl transition shadow-md ${i % 2 === 0 ? COLORS.YES_BUTTON : COLORS.NO_BUTTON} ${voteChoice === opt.id ? COLORS.VOTED_ACTIVE : ''} ${(hasVoted && !requireReason && voteChoice !== opt.id) ? 'opacity-30' : ''}`}>
                                    {opt.prefix} {opt.text}
                                </button>
                            ))}
                            {hasVoted && !isReVoter && !isArchive && !requireReason && (
                                <button onClick={() => { setRequireReason(true); setTempReVoteChoice(null); }} className={`px-6 py-3 ${COLORS.REVOTE_BUTTON} text-white font-bold rounded-xl shadow-md`}>🔄 再投票</button>
                            )}
                        </div>
                    )}
                    {requireReason && (
                        <div className="mt-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <p className="font-bold text-orange-800 mb-2">変更先の選択肢を選び、理由を入力してください</p>
                            <div className="flex gap-2 mb-3">
                                {topicData.options?.map((opt, i) => {
                                    const isOldChoice = opt.id === voteChoice;
                                    const isTempSelected = tempReVoteChoice === opt.id;
                                    let opacityClass = isOldChoice ? 'opacity-30 cursor-not-allowed' : (tempReVoteChoice && !isTempSelected ? 'opacity-50 hover:opacity-100' : '');
                                    return (
                                        <button key={opt.id} onClick={() => setTempReVoteChoice(opt.id)} disabled={isOldChoice} className={`px-4 py-2 rounded-lg text-white text-sm font-bold transition shadow-sm ${i % 2 === 0 ? COLORS.YES_BUTTON : COLORS.NO_BUTTON} ${isTempSelected ? COLORS.VOTED_ACTIVE : ''} ${opacityClass}`}>
                                            {opt.text} {isOldChoice && "(現在)"}
                                        </button>
                                    );
                                })}
                            </div>
                            {tempReVoteChoice && (
                                <div className="relative">
                                    <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-3 border rounded-lg mb-1" maxLength={MAX_REASON_LENGTH} placeholder="考えが変わった理由など..." />
                                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">{reason.length}/{MAX_REASON_LENGTH}</span>
                                </div>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button onClick={submitReason} disabled={!tempReVoteChoice} className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg shadow disabled:opacity-50">確定</button>
                                <button onClick={() => { setRequireReason(false); setReason(""); setTempReVoteChoice(null); }} className="px-4 py-2 bg-gray-300 font-bold rounded-lg">キャンセル</button>
                            </div>
                        </div>
                    )}
                    {showResults ? (
                        <div className="mt-8 p-6 bg-gray-50 border rounded-2xl shadow-inner">
                            <h3 className="font-black text-gray-700 mb-4">投票状況 (合計 {displayTotalVotes} 票)</h3>
                            <div className="space-y-4">
                                {topicData.options?.map((opt, i) => {
                                    const count = votes[opt.id] || 0;
                                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                    const isVisible = showDetailCounts || voteChoice === opt.id;
                                    return (
                                        <div key={opt.id}>
                                            <div className="flex justify-between text-sm font-bold mb-1">
                                                <span className={OPTION_TEXT_COLORS[i % 5]}>{opt.text}</span>
                                                <span className="text-gray-500">{isVisible ? `${pct}% ${showDetailCounts ? `(${count}票)` : ''}` : '??? %'}</span>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div style={{ width: isVisible ? `${pct}%` : '0%' }} className={`h-full transition-all duration-1000 ${OPTION_BG_COLORS[i % 5]}`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : hasVoted && <div className="mt-4 p-4 border bg-gray-50 text-center text-sm text-gray-500">結果は公開期間まで非表示です（戦場の霧）</div>}
                </section>
                <hr className="my-8" />

                {/* 理由エリア */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-6">💬 みんなの理由</h2>
                    {!isArchive && hasVoted && isVotingPhase && !requireReason && (
                        <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-sm font-bold text-blue-800 mb-2">{getOption(voteChoice)?.text}派として理由を投稿</p>
                            <div className="relative">
                                <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-3 border rounded-lg mb-2" placeholder="なぜその選択肢を選びましたか？(任意)" maxLength={MAX_REASON_LENGTH} />
                                <span className="absolute bottom-4 right-2 text-xs text-gray-400">{reason.length}/{MAX_REASON_LENGTH}</span>
                            </div>
                            <button onClick={submitReason} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition">投稿・上書き</button>
                        </div>
                    )}
                    <div className="space-y-6">
                        {(isArchive || showOtherReasons) && (
                            <div className="flex justify-end gap-2 text-xs">
                                <button onClick={() => setSortBy('newest')} className={sortBy === 'newest' ? 'font-bold underline' : 'text-gray-500'}>新着順</button>
                                <button onClick={() => setSortBy('likes')} className={sortBy === 'likes' ? 'font-bold underline' : 'text-gray-500'}>いいね順</button>
                            </div>
                        )}
                        {topReasons.length > 0 && (
                            <div className="p-4 bg-yellow-50 border-4 border-yellow-200 rounded-2xl">
                                <h4 className="font-black text-yellow-700 mb-4 flex items-center gap-2">⭐ TOP注目理由</h4>
                                <div className="space-y-3">
                                    {topReasons.map((r, i) => renderReasonItem(r, i, isArchive))}
                                </div>
                            </div>
                        )}
                        {(showOtherReasons || isArchive) && (isArchive ? (activeReasonTab === 'all' ? (topicData.options?.flatMap(opt => sortedReasonsMap[opt.id] || []) || []) : sortedReasonsMap[activeReasonTab] || []) : otherReasons).map((r, i) => renderReasonItem(r, i, isArchive))}
                        {!showOtherReasons && !isArchive && otherReasons.length > 0 && (
                            <button onClick={() => setShowOtherReasons(true)} className="w-full py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition">▼ 他の理由を見る ({otherReasons.length}件)</button>
                        )}
                        {topReasons.length === 0 && otherReasons.length === 0 && <p className="text-gray-500 text-center py-4">まだ理由が投稿されていません。</p>}
                    </div>
                </section>
                <div className="lg:hidden w-full bg-gray-100 h-24 my-8 flex items-center justify-center text-gray-400 text-sm border">[スマホ用広告]</div>
                <hr className="my-8" />

                {/* 掲示板エリア */}
                <section className="pb-20">
                    <h2 className="text-xl font-bold mb-4">{isDiscussionPhase || isArchive ? "🗣️ 議論掲示板" : "🔒 陣営別掲示板"} ({displayCommentCount}件)</h2>
                    {isArchive && (
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                            <button onClick={() => setActiveBoardTab('discussion')} className={`px-3 py-1 rounded-full text-sm font-bold ${activeBoardTab === 'discussion' ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE}`}>議論全体</button>
                            {topicData.options?.map(opt => (
                                <button key={opt.id} onClick={() => setActiveBoardTab(opt.id)} className={`px-3 py-1 rounded-full text-sm font-bold ${activeBoardTab === opt.id ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE}`}>{opt.text}派</button>
                            ))}
                        </div>
                    )}
                    {!isArchive && isVotingPhase && voteChoice && <p className="text-sm text-blue-600 font-bold mb-4 bg-blue-50 p-2 rounded">※ 投票フェーズ中は、自陣営のコメントのみ表示されます</p>}

                    <div className="space-y-2 mb-6 max-h-[600px] overflow-y-auto pr-2">
                        {displayedComments.map((c, i) => (
                            <div key={(c as any).id || i} className="p-3 bg-gray-50 border rounded-lg hover:bg-white transition">
                                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                                    <span className="flex items-center gap-1">No.{getCommentNumber(i)} | {getOption(c.userVoteChoice)?.text}派 {c.isReVoter && <span className="bg-orange-100 text-orange-600 px-1 rounded text-[9px]">🔄再</span>}</span>
                                    <span>{c.timestamp}</span>
                                </div>
                                {c.quoteNumber && <div className="text-[10px] bg-gray-200 border-l-4 border-gray-400 pl-2 py-1 mb-2 text-gray-600 italic">{c.quoteNumber} への返信</div>}
                                <p className="text-sm text-gray-800 leading-relaxed">{c.text}</p>
                                {!isArchive && (
                                    <div className="flex justify-end gap-3 mt-1 items-center">
                                        <button onClick={() => handleLikeComment((c as any).id, (c as any).likedUserIds || [])} className="text-[10px] text-gray-400 hover:text-pink-500 flex items-center gap-1 transition">
                                            {(c as any).likedUserIds?.includes(userId) ? '❤️' : '🤍'} {(c as any).likeCount || 0}
                                        </button>
                                        <button onClick={() => handleQuoteClick(getCommentNumber(i))} className="text-[10px] text-blue-500 font-bold hover:underline">返信</button>

                                        {/* 🚨 通報ボタン（修正箇所：文字色を濃くし、表示条件を追加） */}
                                        {userId !== (c as any).userId && !reportedIds.has((c as any).id) && (
                                            <button onClick={() => handleReportComment(c)} className="text-[10px] text-gray-400 hover:text-red-500 underline decoration-gray-400">通報</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {displayedComments.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">コメントはありません</p>}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-4 text-sm mt-4 mb-4">
                            <button disabled={commentPage === 1} onClick={() => setCommentPage(p => p - 1)} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-30">前へ</button>
                            <span className="font-bold">{commentPage} / {totalPages}</span>
                            <button disabled={commentPage === totalPages} onClick={() => setCommentPage(p => p + 1)} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-30">次へ</button>
                        </div>
                    )}

                    {!isArchive && hasVoted && (
                        <div className="p-4 bg-white border-2 border-gray-200 rounded-2xl shadow-lg">
                            {quoteNumber && <div className="text-xs bg-yellow-100 p-2 rounded mb-2 flex justify-between items-center"><span>No.{quoteNumber} を引用中</span><button onClick={() => setQuoteNumber(null)} className="text-red-500 font-bold">解除</button></div>}
                            <div className="relative">
                                <textarea ref={commentInputRef} value={newComment} onChange={e => setNewComment(e.target.value)} className="w-full p-3 border rounded-xl mb-2 focus:ring-2 focus:ring-blue-500" placeholder="コメントを入力..." maxLength={MAX_COMMENT_LENGTH} />
                                <span className="absolute bottom-4 right-2 text-xs text-gray-400">{newComment.length}/{MAX_COMMENT_LENGTH}</span>
                            </div>
                            <button onClick={handleComment} className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition shadow-lg">コメントを送信</button>
                        </div>
                    )}
                </section>
            </div>
            <div className="hidden lg:block w-48 bg-gray-100 text-center p-4 mx-2 shadow-md">📢 PC広告</div>
        </div>
    );
}