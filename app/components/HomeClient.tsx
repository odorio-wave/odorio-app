"use client";


import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Topic,
    Proposal,
    ProposalOption
} from "../dynamic_topic"; // 型定義のインポート
import ShareButtons from "../components/ShareButtons";
import Toast from "../components/Toast";
import TopicSection from '../components/TopicSection';
import ArchiveSection from "../components/ArchiveSection";
import NinjaAdMax from "@/app/components/NinjaAdMax";

// ★ Firebase Imports
import { db } from "../lib/firebase";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
    collection, doc, setDoc, updateDoc,
    onSnapshot, query,
    arrayUnion, arrayRemove, writeBatch,
    getDoc, getDocs
} from "firebase/firestore";

// --- カラー定義
const COLORS = {
    BUTTON_PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white",
    BUTTON_SECONDARY: "bg-gray-200 hover:bg-gray-300 text-gray-800",
};

// 定数
const MAX_TITLE_LENGTH = 40;
const MAX_DESC_LENGTH = 300;
const MAX_OPTION_LENGTH = 15;

// 安全な日付変換ヘルパー関数
// FirestoreのTimestamp型も、文字列の日付も、Date型もすべて「Dateオブジェクト」に統一して返します
const getTopicDate = (d: any) => {
    if (!d) return new Date(); // データがない場合は現在時刻（エラー回避）
    // Firestore Timestamp型の場合 (.toDate()メソッドを持つ)
    if (typeof d.toDate === 'function') {
        return d.toDate();
    }
    // すでにDate型の場合
    if (d instanceof Date) {
        return d;
    }
    // 文字列や数値の場合
    return new Date(d);
};

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
            const endDate = getTopicDate(t.endDate).getTime();

            // まだ終了していないなら何もしない (現在時刻 <= 終了日時)
            if (nowTime <= endDate) return;

            if (t.status !== 'published') return; // 公開中以外は何もしない
            if (t.type === 'archive') return; // 既にアーカイブなら何もしない

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
                    // ここで type: 'official' を明示して、週替わり化を防ぐ
                    const nextEndDate = new Date();
                    nextEndDate.setDate(nextEndDate.getDate() + 7); // 次の期間をセット(例:7日後)

                    await updateDoc(doc(db, "topics", t.topicId || t.id), {
                        startDate: new Date().toISOString(),
                        endDate: nextEndDate.toISOString(),
                        votes: {},         // 票をリセット
                        votedUserIds: [],  // 「投票した人リスト」もリセットしないと、来週投票できなくなる！
                        type: 'official'   // これがないと週替わりになってしまいます
                    });

                    onUpdate();
                } catch (e) { console.error(e); }
            }
        });
    }, [initialTopics, now, onUpdate]);
}

// お題リクエストの自動クリア処理（毎週月曜 9:00以降 に実行）
function useAutoClearProposals(now: Date) {
    useEffect(() => {
        const checkAndClear = async () => {
            // 1. 月曜日 (Day 1) でなければ何もしない
            if (now.getDay() !== 1) return;

            // 9時前なら何もしない (0時〜8時59分はスルー)
            if (now.getHours() < 9) return;

            try {
                // 2. 「今週(今日)はもうクリアしたか？」をチェック
                const configRef = doc(db, "system", "config");
                const configSnap = await getDoc(configRef);

                if (configSnap.exists()) {
                    const lastClear = configSnap.data().lastProposalClear;
                    if (lastClear) {
                        const lastDate = lastClear.toDate();
                        const isSameDay =
                            lastDate.getFullYear() === now.getFullYear() &&
                            lastDate.getMonth() === now.getMonth() &&
                            lastDate.getDate() === now.getDate();

                        // 既に今日(月曜)の日付で記録があれば何もしない
                        if (isSameDay) return;
                    }
                }

                // 3. 削除実行
                const q = query(collection(db, "proposals"));
                const querySnapshot = await getDocs(q);

                // データが空でも「処理済み」として記録するためにBatch処理へ進む
                // (データがない場合も timestamp を更新しないと、毎回DBチェックが走ってしまうため)

                const batch = writeBatch(db);

                if (!querySnapshot.empty) {
                    querySnapshot.docs.forEach((d) => {
                        batch.delete(d.ref);
                    });
                }

                // 4. 「クリア完了」の記録を残す（これで今日のうちはもう実行されない）
                batch.set(configRef, { lastProposalClear: new Date() }, { merge: true });

                await batch.commit();
                console.log("月曜9時を過ぎたため、お題リクエストをリセットしました");

            } catch (e) {
                console.error("リセット処理エラー:", e);
            }
        };

        checkAndClear();
    }, [now]); // nowは1分ごとに更新されるため、9時になった瞬間に検知できます
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

        // 1. Firebase Authの初期化と監視
        const auth = getAuth();
        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid); // ここで詳細ページと同じIDが取得されます
            } else {
                await signInAnonymously(auth);
            }
        });

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
            unsubAuth(); // Auth監視の解除
            unsubTopics();
            unsubProposals();
            unsubConfig();
            clearInterval(timerId);
        };
    }, []);

    // 既存の自動アーカイブ処理
    useCheckAndArchive(allTopics, now, () => { });

    // お題リクエストの自動クリア処理
    useAutoClearProposals(now);

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

    // 文字数が制限を超えているか判定してクラス名を返す関数
    const getCountStyle = (current: number, max: number) => {
        return current > max ? "text-red-500 font-bold" : "text-gray-400 font-normal";
    };

    const submitProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposalInput.trim()) return showToast("タイトルを入力してください", "error");
        if (proposalInput.length > MAX_TITLE_LENGTH) return showToast(`タイトルは${MAX_TITLE_LENGTH}文字以内で入力してください`, "error");

        if (proposalDescription.length > MAX_DESC_LENGTH) return showToast(`説明文は${MAX_DESC_LENGTH}文字以内で入力してください`, "error");

        const validOptions = proposalOptions.filter(opt => opt.text.trim());
        if (validOptions.length < 2) return showToast("選択肢は最低2つ必要です", "error");

        // 選択肢の文字数チェック
        const isOptionOver = validOptions.some(opt => opt.text.length > MAX_OPTION_LENGTH);
        if (isOptionOver) return showToast(`選択肢は${MAX_OPTION_LENGTH}文字以内で入力してください`, "error");

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
        // now が Dateオブジェクトでない場合に備えてチェック
        const baseDate = now instanceof Date ? now : new Date();
        const nowTime = baseDate.getTime();

        const current: Topic[] = [];
        const upcoming: Topic[] = [];
        const archive: Topic[] = [];
        const official: Topic[] = [];



        allTopics.forEach((t) => {
            // 1. ステータスチェック
            // 「公開中」または「アーカイブ済み」なら表示OKとする
            const isVisible = t.status === 'published' || t.status === 'archived';
            const isArchivedType = t.type === 'archive'; // 手動アーカイブ

            // 2. 日付の計算
            const s = getTopicDate(t.startDate).getTime();
            const e = getTopicDate(t.endDate).getTime();
            const a = (t as any).announcementDate
                ? getTopicDate((t as any).announcementDate).getTime()
                : 0;
            const isEnded = nowTime > e;

            // A. 非表示は無視
            if (!isVisible) return;

            // B. 手動アーカイブは最優先でアーカイブへ
            if (isArchivedType) {
                archive.push(t);
                return;
            }

            // C. 未来の日付なら「予告」へ
            if (nowTime < s) {
                if (a > 0 && nowTime < a) {
                    return;
                }
                upcoming.push(t);
                return;
            }

            // D. 期限切れなら「アーカイブ」へ
            if (isEnded) {
                archive.push(t);
                return;
            }

            // E. 開催中
            if (t.type === "official") {
                official.push(t);
                return;
            }
            current.push(t);
        });

        // 3. 並び替え
        const sortByDateDesc = (a: Topic, b: Topic) => getTopicDate(b.startDate).getTime() - getTopicDate(a.startDate).getTime();
        const sortByDateAsc = (a: Topic, b: Topic) => getTopicDate(a.startDate).getTime() - getTopicDate(b.startDate).getTime();

        current.sort(sortByDateDesc);   // 新しい順
        official.sort(sortByDateDesc);  // 新しい順
        upcoming.sort(sortByDateAsc);   // 開催が近い順（昇順）
        archive.sort((a, b) => getTopicDate(b.endDate).getTime() - getTopicDate(a.endDate).getTime()); // 終了が新しい順

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

    // ソート済み提案
    const sortedProposals = useMemo(() => {
        return [...proposals].sort((a, b) => {
            if (proposalSortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [proposals, proposalSortBy]);

    return (
        <main className="min-h-screen bg-gray-50">
            {/* <div className="fixed top-0 left-0 z-50 bg-red-600 text-white p-2 font-bold text-xs break-all">My ID: {userId}</div> */}
            <Toast message={toast?.message || ""} type={toast?.type} onClose={() => setToast(null)} />

            <div className="flex justify-center items-start gap-6 p-4">
                {/* PC用広告枠 1 */}
                <aside className="hidden lg:block w-[180px] shrink-0">
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/ccde4842e0ee972292ffd0af14da1153"
                            width={160}
                            height={600}
                        />
                    </div>
                    {/* PC用広告枠 2 */}
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/5796a1df3384f32b8ff113d1b3fc31ca"
                            width={160}
                            height={600}
                        />
                    </div>
                    {/* PC用広告枠 3 */}
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/43665ec689a0b8d7050998beb6d85f2a"
                            width={160}
                            height={600}
                        />
                    </div>
                </aside>

                <div className="w-full max-w-4xl flex-1">
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
                    <header className="bg-white border-b border-gray-200 py-6 px-4 mb-6">
                        <div className="max-w-4xl mx-auto flex flex-col items-center">
                            <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-2 tracking-tight text-center">
                                ODORIO（オドリオ）
                            </h1>
                            <p className="text-xs md:text-lg text-gray-500 mb-4 font-medium text-center">
                                “今”気になるトピックをみんなで投票・議論
                            </p>

                            {/* <div className="mb-5 text-sm text-gray-600">
                                <span>
                                    ゲスト (<Link href="/login" className="text-blue-600 hover:underline">ログイン</Link>)
                                </span>
                            </div> */}
                            <div>
                                <ShareButtons
                                    title="ODORIO - 投票×議論"
                                />
                            </div>
                        </div>
                    </header>

                    {/* スマホ用広告枠 1 (ヘッダー下) */}
                    <div className="block lg:hidden w-full flex justify-center mb-8">
                        <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                            <NinjaAdMax
                                src="https://adm.shinobi.jp/o/9d677c816218bf963562ac34ff6e55a3"
                                width={300}
                                height={250}
                            />
                        </div>
                    </div>

                    {/* Phase Info */}
                    {isMounted && (
                        <section style={{ borderColor: phase.color, background: "#fff" }} className="flex items-center gap-3 p-3 border-l-4 rounded-md shadow-md mb-6">
                            <div style={{ width: 12, height: 12, borderRadius: 6, background: phase.color }} />
                            <div className="flex-1">
                                <div className="text-base font-semibold">{phase.label}</div>
                                <div className="text-sm text-gray-600">
                                    次のフェーズ切替まで：{hours}時間{minutes}分
                                </div>
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
                            userId={userId}
                        />

                        {/* 2. 週替わりお題 */}
                        <TopicSection
                            title="📅 週替わりお題"
                            icon="🔥"
                            topics={current}
                            initialCount={2}
                            emptyMessage="現在、今週の週替わりお題は準備中です。ODORIO（オドリオ）では、毎週新しいトピックを追加し、みんなで投票と議論を行っています。新しいお題が公開されるまでの間は、ぜひ下部の「お題をリクエスト（掲示板）」からあなたが気になっている究極の2択や、議論したいテーマを投稿してみてください。また、常設のお題への投票もお待ちしております！"
                            isResultsVisible={showResults} // ★フラグを渡す
                            userId={userId}
                        />

                        {/* 3. 次のお題予告 */}
                        <TopicSection
                            title="🔮 次のお題予告"
                            icon="✨"
                            topics={upcoming}
                            initialCount={2}
                            emptyMessage="予告はまだありません"
                            isResultsVisible={false} // 予告なので結果は非表示
                            userId={userId}
                        />

                        {/* スマホ用広告枠 2 (掲示板の上) */}
                        <div className="block lg:hidden w-full flex justify-center my-6">
                            <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                                <NinjaAdMax
                                    src="https://adm.shinobi.jp/o/8dc96ece81d777792808ae5657ae7317"
                                    width={300}
                                    height={250}
                                />
                            </div>
                        </div>

                        {/* 掲示板エリア (提案 & 候補リスト) */}
                        <section className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-10">
                            <h2 className="text-xl font-black mb-4 text-blue-900">
                                ✍️ お題をリクエスト（掲示板）
                            </h2>
                            <form onSubmit={submitProposal} className="space-y-4">
                                {/* タイトル */}
                                <div>
                                    <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                                        <span>
                                            タイトル <span className="text-[10px] font-normal text-gray-400">（最大{MAX_TITLE_LENGTH}文字）</span>
                                        </span>
                                        <span className={getCountStyle(proposalInput.length, MAX_TITLE_LENGTH)}>
                                            {proposalInput.length}/{MAX_TITLE_LENGTH}
                                        </span>
                                    </label>
                                    <input
                                        value={proposalInput}
                                        onChange={e => setProposalInput(e.target.value)}
                                        placeholder="例: 犬派？猫派？"
                                        className="w-full p-3 border rounded-xl shadow-sm bg-white"
                                    />
                                </div>
                                {/* 説明 */}
                                <div>
                                    <label className="block text-xs font-bold text-blue-800 mb-1 ml-1 flex justify-between">
                                        <span>
                                            説明文 <span className="text-[10px] font-normal text-gray-400">（最大{MAX_DESC_LENGTH}文字）</span>
                                        </span >
                                        <span className={getCountStyle(proposalDescription.length, MAX_DESC_LENGTH)}>
                                            {proposalDescription.length}/{MAX_DESC_LENGTH}
                                        </span>
                                    </label>
                                    <textarea
                                        value={proposalDescription}
                                        onChange={e => setProposalDescription(e.target.value)}
                                        placeholder="背景や理由"
                                        className="w-full p-3 border rounded-xl h-20 shadow-sm bg-white"
                                    />
                                </div>
                                {/* 選択肢 */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-blue-800 ml-1">
                                        選択肢 <span className="text-[10px] font-normal text-gray-400">（最大{MAX_OPTION_LENGTH}文字）</span>
                                    </label>

                                    {proposalOptions.map((opt, i) => (
                                        <div key={i}>
                                            <div className="flex justify-end mb-1 px-1">
                                                <span className={`text-[10px] ${getCountStyle(opt.text.length, MAX_OPTION_LENGTH)}`}>
                                                    {opt.text.length}/{MAX_OPTION_LENGTH}
                                                </span>
                                            </div>

                                            <div className="flex gap-2 items-center">
                                                <input
                                                    value={opt.prefix}
                                                    onChange={e => handleOptionChange(i, 'prefix', e.target.value)}
                                                    className="w-12 text-center p-2 border rounded-lg bg-white"
                                                />
                                                <input
                                                    value={opt.text}
                                                    onChange={e => handleOptionChange(i, 'text', e.target.value)}
                                                    className="flex-1 p-2 border rounded-lg bg-white"
                                                    placeholder={`選択肢${i + 1}`}
                                                />
                                                {proposalOptions.length > 2 &&
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOption(i)}
                                                        className="text-red-400"
                                                    >
                                                        ✕
                                                    </button>
                                                }
                                            </div>
                                        </div>
                                    ))}
                                    {proposalOptions.length < 3 &&
                                        <button
                                            type="button"
                                            onClick={addOption}
                                            className="text-blue-600 text-xs font-black mt-1"
                                        >
                                            + 追加
                                        </button>
                                    }
                                </div>
                                <button
                                    type="submit"
                                    className={`w-full py-2 rounded font-bold ${COLORS.BUTTON_PRIMARY}`}
                                >
                                    投稿する
                                </button>
                            </form>

                            {/* 候補リスト */}
                            <div className="mt-6 border-t pt-4">
                                <h3 className="text-lg font-semibold mb-2">
                                    候補リスト
                                </h3>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => { setProposalSortBy('votes'); setProposalPage(1); }}
                                        className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'votes' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                    >
                                        いいね順
                                    </button>
                                    <button
                                        onClick={() => { setProposalSortBy('date'); setProposalPage(1); }}
                                        className={`text-xs px-2 py-1 rounded border ${proposalSortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                    >
                                        新着順
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {sortedProposals.slice((proposalPage - 1) * PROPOSALS_PER_PAGE, proposalPage * PROPOSALS_PER_PAGE).map(p => (
                                        <div key={p.id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm">
                                            <div className="font-bold text-sm text-gray-800">{p.title}</div>
                                            <button
                                                onClick={() => voteProposal(p.id)}
                                                className={`px-4 py-1 rounded-full text-xs font-black transition ${((p as any).voterIds || []).includes(userId) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                                            >
                                                👍 {p.votes || 0}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {/* ページネーション */}
                                {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE) > 1 && (
                                    <div className="flex justify-center gap-4 mt-4 text-xs font-bold text-gray-500">
                                        <button
                                            onClick={() => setProposalPage(p => Math.max(1, p - 1))}
                                            disabled={proposalPage === 1}
                                        >
                                            前へ
                                        </button>
                                        <span>{proposalPage} / {Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}</span>
                                        <button
                                            onClick={() => setProposalPage(p => Math.min(Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE), p + 1))}
                                            disabled={proposalPage === Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE)}
                                        >
                                            次へ
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* スマホ用広告枠 3 (フッター上) */}
                        <div className="block lg:hidden w-full flex justify-center my-6">
                            <div className="w-[300px] min-h-[250px] bg-gray-50 flex justify-center items-center shadow-sm">
                                <NinjaAdMax
                                    src="https://adm.shinobi.jp/o/bcfd70eeae86a589a959a2266608646b"
                                    width={300}
                                    height={250}
                                />
                            </div>
                        </div>

                        {/* アーカイブ */}
                        <ArchiveSection
                            initialArchives={archive}
                            userId={userId}
                            onLike={toggleArchiveLike}
                        />

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

                <aside className="hidden lg:block w-[180px] shrink-0">
                    {/* PC用広告枠 4 */}
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/b229b2136fd60c069bb1cafdfac03d18"
                            width={160}
                            height={600}
                        />
                    </div>
                    {/* PC用広告枠 5 */}
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/e54d179f5295ed56869ee07d65b0e178"
                            width={160}
                            height={600}
                        />
                    </div>
                    {/* PC用広告枠 6 */}
                    <div className="mb-6 w-full min-h-[600px] bg-gray-100 flex justify-center items-center shadow-sm rounded">
                        <p className="text-xs text-gray-400 mb-1">PR</p>
                        <NinjaAdMax
                            src="https://adm.shinobi.jp/s/0cba30e90f4b526e8923632861403c99"
                            width={160}
                            height={600}
                        />
                    </div>
                </aside>
            </div>
        </main >
    );
}