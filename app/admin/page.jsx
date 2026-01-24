"use client";
import React, { useState, useEffect, useMemo } from 'react';
// 共通の設定ファイルを読み込む (パスはあなたの環境に合わせてください)
import { db, auth } from "@/app/lib/firebase"; // ← これが重要！
import { signInAnonymously } from "firebase/auth";
import {
    collection, doc, setDoc, deleteDoc, onSnapshot, query, updateDoc
} from "firebase/firestore";

// データ保存場所を統一するためのID定数
const APP_ID = 'odorio-v1';

// フェーズ管理キーと値の定義
const PHASE_KEY = "DUMMY_PHASE_KEY";
const LS_PROPOSALS = "site_proposals_v1";
const LS_ADMIN_TOPICS = "admin_managed_topics_v1"; // 運営が作成したお題の保存キー
const ALL_TOPICS_LS_KEY = "admin_all_topics_v1";
const LS_LAST_PROPOSAL_RESET = "site_last_proposal_reset_v1";

const PHASES = [
    { key: "voting", label: "🗳️ 投票フェーズ", color: "blue-600" },
    { key: "public", label: "📊 結果公開フェーズ", color: "yellow-600" },
    { key: "blackout", label: "🔒 非公開フェーズ", color: "gray-600" },
    { key: "discussion", label: "🗣️ 議論フェーズ", color: "green-600" },
];

// 日付入力欄用フォーマット関数 (YYYY-MM-DDThh:mm)
const toLocalISOString = (date) => {
    const pad = (num) => (num < 10 ? '0' + num : num);
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes());
};

// 次の月曜9:00を取得するヘルパー
const getNextMonday9AM = () => {
    const d = new Date();
    d.setHours(9, 0, 0, 0); // 9:00:00
    const day = d.getDay(); // 0:Sun, 1:Mon...

    // 次の月曜までの日数を計算
    // 今日が月曜で9時を過ぎていれば来週、そうでなければ次の月曜
    let diff = (1 + 7 - day) % 7;
    if (diff === 0 && d.getTime() < Date.now()) {
        diff = 7;
    }
    d.setDate(d.getDate() + diff);
    return d;
};

// フェーズ設定をFirestoreに保存する関数
const setOverridePhase = async (phaseKey) => {
    try {
        // 'auto' が選ばれたら null を保存する
        const valueToSave = phaseKey === 'auto' ? null : phaseKey;

        await setDoc(doc(db, "system", "config"), {
            phaseMode: valueToSave
        }, { merge: true });

        alert(`フェーズ設定を「${phaseKey === 'auto' ? '自動モード' : phaseKey}」に変更し、データベースに保存しました。`);
    } catch (error) {
        console.error("フェーズ設定エラー:", error);
        alert("設定の保存に失敗しました。");
    }
};

export default function AdminControl() {
    const [currentPhase, setCurrentPhase] = useState('auto');
    const [userProposals, setUserProposals] = useState([]);
    const [adminTopics, setAdminTopics] = useState([]); // 運営が作成・公開したお題
    const [now, setNow] = useState(new Date());

    // 編集中のトピックID (nullなら新規作成モード)
    const [editingTopicId, setEditingTopicId] = useState(null);

    // 新規お題作成フォームの状態
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    // 選択肢の初期値 (IDは固定し、入力中に変更しない)
    const [options, setOptions] = useState([
        { id: 'opt_initial_1', prefix: '1.', text: '' },
        { id: 'opt_initial_2', prefix: '2.', text: '' },

    ]);
    const [topicType, setTopicType] = useState('weekly'); // ★ 新規お題のタイプ ★

    // 公開設定
    const [publishMode, setPublishMode] = useState('scheduled');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // 復活モーダル用の状態
    const [restoringTopic, setRestoringTopic] = useState(null); // 復活対象のトピック
    const [restoreStartDate, setRestoreStartDate] = useState('');
    const [restoreEndDate, setRestoreEndDate] = useState('');
    const [restoreMode, setRestoreMode] = useState('immediate'); // 'immediate' | 'scheduled'

    // お題候補のページネーションとソート用 State
    const [proposalPage, setProposalPage] = useState(1);
    const [proposalSortBy, setProposalSortBy] = useState('votes'); // 'votes' | 'date'
    const PROPOSALS_PER_PAGE = 10;

    // --- データ操作ヘルパー ---
    // 運営が作成・公開したお題リストを保存する関数
    const resetForm = () => {
        setTitle('');
        setDescription('');
        // 選択肢を初期状態に戻す
        setOptions([
            { id: `opt_reset_${Date.now()}_1`, prefix: '1.', text: '' },
            { id: `opt_reset_${Date.now()}_2`, prefix: '2.', text: '' }
        ]);
        setEditingTopicId(null); // 編集モード解除

        // 日時のリセット (現在と来週に設定)
        const currentNow = new Date();
        const nextWeek = new Date(currentNow.getTime() + 7 * 24 * 60 * 60 * 1000);
        setStartDate(toLocalISOString(currentNow));
        setEndDate(toLocalISOString(nextWeek));
        setPublishMode('scheduled'); // デフォルトに戻す
    };

    const handleOptionChange = (index, field, value) => {
        setOptions(prev => prev.map((opt, i) => {
            // IDの更新処理を削除し、既存のIDをそのまま使います
            if (i === index) return { ...opt, [field]: value };
            return opt;
        }));
    };

    const addOption = () => {
        if (options.length < 5) {
            setOptions([...options, { id: `opt_${Date.now()}_new`, prefix: (options.length + 1) + '.', text: '' }]);
        }
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index)
                .map((opt, i) => ({ ...opt, prefix: `${i + 1}.` }));
            setOptions(newOptions);
        }
    };

    // 自動設定ボタンの処理
    const setAutoSchedule = () => {
        const nextMon = getNextMonday9AM();
        const nextNextMon = new Date(nextMon);
        nextNextMon.setDate(nextNextMon.getDate() + 7);

        setStartDate(toLocalISOString(nextMon));
        setEndDate(toLocalISOString(nextNextMon));
        alert(`📅 日時を自動セットしました。\n開始: ${nextMon.toLocaleString()}\n終了: ${nextNextMon.toLocaleString()}`);
    };

    // 復活用の自動スケジュール設定
    const setRestoreAutoSchedule = () => {
        const nextMon = getNextMonday9AM();
        const nextNextMon = new Date(nextMon);
        nextNextMon.setDate(nextNextMon.getDate() + 7);

        setRestoreStartDate(toLocalISOString(nextMon));
        setRestoreEndDate(toLocalISOString(nextNextMon));
        setRestoreMode('scheduled'); // 自動的に予約モードにする
        alert(`📅 復活日時を自動セットしました。\n開始: ${nextMon.toLocaleString()}\n終了: ${nextNextMon.toLocaleString()}`);
    };

    // ★ 新規お題の作成・投稿ロジック ★
    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("1. 送信ボタンが押されました"); // ★ログ
        const validOptions = options.filter(opt => opt.text.trim());

        if (!title.trim()) {
            return alert("⚠️ エラー: タイトルを入力してください。");
        }
        if (validOptions.length < 2) {
            return alert("⚠️ エラー: 選択肢を2つ以上入力してください。");
        }

        // 日時の設定
        let finalStartDate = startDate;
        let finalEndDate = endDate;
        const currentNow = new Date();

        // 予約投稿モードで日時が空の場合、自動補完する
        if (publishMode === 'scheduled') {
            if (!finalStartDate) {
                const nextMon = getNextMonday9AM();
                finalStartDate = toLocalISOString(nextMon);
            }
            if (!finalEndDate) {
                // 開始日時が決まっていれば、そこから7日後。なければ次の月曜から7日後
                const startBase = finalStartDate ? new Date(finalStartDate) : getNextMonday9AM();
                const endBase = new Date(startBase);
                endBase.setDate(endBase.getDate() + 7);
                finalEndDate = toLocalISOString(endBase);
            }
        } else {
            // 即時公開モード
            finalStartDate = toLocalISOString(currentNow);
            // 終了日時がなければ、無期限(常設) or 1週間後(週替わり)
            if (!finalEndDate) {
                if (topicType === 'weekly') {
                    const nextWeek = new Date(currentNow.getTime() + 7 * 24 * 60 * 60 * 1000);
                    finalEndDate = toLocalISOString(nextWeek);
                } else {
                    finalEndDate = '2099-12-31T23:59:59';
                }
            }
        }

        // 保存するデータオブジェクト
        const topicIdToSave = editingTopicId || `adm_${Date.now()}`;
        const newTopic = {
            topicId: topicIdToSave,
            title: title.trim(),
            description: description.trim(),
            options: validOptions,
            type: topicType,
            status: 'published',
            createdAt: editingTopicId ? (adminTopics.find(t => t.topicId === editingTopicId)?.createdAt || currentNow.toISOString()) : currentNow.toISOString(),
            startDate: new Date(finalStartDate).toISOString(),
            endDate: new Date(finalEndDate).toISOString(),

            // 票数の初期化
            // これがないと、最初の1票が入るまでホームページでエラーになる可能性があります
            votes: {},
        };

        // undefined削除
        Object.keys(newTopic).forEach(key => newTopic[key] === undefined && delete newTopic[key]);

        try {
            console.log("2. Firestoreへの保存を開始します..."); // ★ログ
            // ★ Firestoreに保存 (topicsコレクション) ★
            await setDoc(doc(db, "topics", topicIdToSave), newTopic, { merge: true });
            console.log("3. 保存が完了しました！"); // ★ログ
            alert(editingTopicId ? "✅ お題を更新しました！" : "✅ 新規お題を公開しました！");
            resetForm();
        } catch (error) {
            console.error("保存エラー:", error);
            alert("保存中にエラーが発生しました。");
        }
    };

    // ★ 既存のお題（公開中・予約中）を編集フォームにロードする関数 ★
    const loadTopicForEdit = (topic) => {
        if (!confirm(`「${topic.title}」を編集しますか？\nフォームの内容は上書きされます。`)) return;

        // IDをセットすることで更新モードにする
        setEditingTopicId(topic.topicId);
        setTitle(topic.title);
        setDescription(topic.description);
        setOptions(topic.options.map(opt => ({ ...opt })));
        setTopicType(topic.type);
        setStartDate(toLocalISOString(new Date(topic.startDate)));
        setEndDate(toLocalISOString(new Date(topic.endDate)));
        setPublishMode('scheduled');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ★ ユーザー投稿お題を新規作成としてロードする関数 ★
    const loadProposalForEdit = (proposal) => {
        if (confirm(`「${proposal.title}」を編集フォームにロードしますか？\n（これは新規作成として扱われます）`)) {
            // IDをnullにすることで新規モードにする
            setEditingTopicId(null);

            setTitle(proposal.title);
            setDescription(proposal.description || '');
            const optionsWithIds = proposal.options.map((opt, index) => ({
                id: `opt_loaded_${index}`,
                prefix: `${index + 1}.`,
                text: opt.text
            }));
            setOptions(optionsWithIds);

            // 日時はリセット
            const currentNow = new Date();
            const nextWeek = new Date(currentNow.getTime() + 7 * 24 * 60 * 60 * 1000);
            setStartDate(toLocalISOString(currentNow));
            setEndDate(toLocalISOString(nextWeek));
            setPublishMode('scheduled');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // 運営管理リストからのアクション (Firestore対応)
    const deleteTopic = async (topicId) => {
        if (!confirm("🗑️ 本当に削除しますか？\nデータベースからも完全に削除されます。")) return;
        if (editingTopicId === topicId) resetForm();
        try {
            await deleteDoc(doc(db, "topics", topicId));
            alert("削除しました。");
        } catch (e) {
            alert("削除に失敗しました。");
        }
    };

    // 一時公開停止ロジック (statusのトグル)
    const togglePublishTopic = async (topicId, currentStatus) => {
        const newStatus = currentStatus === 'published' ? 'pending' : 'published';
        try {
            await updateDoc(doc(db, "topics", topicId), { status: newStatus });
            alert(newStatus === 'published' ? "再公開しました。" : "一時非公開にしました。");
        } catch (e) {
            alert("ステータス変更に失敗しました。");
        }
    };

    // 手動アーカイブ機能
    const manualArchiveTopic = async (topicId) => {
        if (!confirm("📦 このお題をアーカイブに移動しますか？")) return;
        try {
            await updateDoc(doc(db, "topics", topicId), { type: 'archive', status: 'archived' });
            alert("アーカイブに移動しました。");
        } catch (e) {
            alert("アーカイブ移動に失敗しました。");
        }
    };

    // 復活ボタンクリック時の処理 (モーダルを開く)
    const handleRestoreClick = (topic) => {
        setRestoringTopic(topic);
        const currentNow = new Date();
        const nextWeek = getNextMonday9AM();
        setRestoreStartDate(toLocalISOString(currentNow));
        setRestoreEndDate(toLocalISOString(nextWeek));
        setRestoreMode('immediate');
    };

    // 復活実行処理
    const executeRestore = async () => {
        if (!restoringTopic) return;
        let finalStart = restoreStartDate;
        if (restoreMode === 'immediate') finalStart = new Date().toISOString();

        if (!finalStart || !restoreEndDate) {
            alert("日時設定が不正です。");
            return;
        }

        try {
            await setDoc(doc(db, "topics", restoringTopic.topicId), {
                type: restoringTopic.originalEndpointId ? 'official' : 'weekly',
                status: 'published',
                startDate: new Date(finalStart).toISOString(),
                endDate: new Date(restoreEndDate).toISOString()
            }, { merge: true });
            alert(`✅ 「${restoringTopic.title}」を復活させました！`);
            setRestoringTopic(null);
        } catch (e) {
            alert("復活に失敗しました。");
        }
    };

    // 管理画面を開いたらログインする
    useEffect(() => {
        const login = async () => {
            try {
                // すでにログインしていなければ、匿名ログインする
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                    console.log("管理画面: ログインしました");
                }
            } catch (e) {
                console.error("ログインエラー:", e);
            }
        };
        login();
    }, []);

    // データのリアルタイム監視
    useEffect(() => {
        const currentNow = new Date();
        setNow(currentNow);
        setStartDate(toLocalISOString(currentNow));
        setEndDate(toLocalISOString(new Date(currentNow.getTime() + 7 * 86400000)));

        // 1. お題
        const unsubTopics = onSnapshot(query(collection(db, "topics")), (snapshot) => {
            const list = snapshot.docs.map((d) => d.data());
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAdminTopics(list);
        });

        // 2. 提案
        const unsubProposals = onSnapshot(query(collection(db, "proposals")), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            setUserProposals(list);
        });

        // 3. 設定
        const unsubConfig = onSnapshot(doc(db, "system", "config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.phaseMode) setCurrentPhase(data.phaseMode);
                // 自動リセットチェック
                checkAndResetProposals(data.lastProposalReset);
            } else {
                setCurrentPhase('auto');
            }
        });

        const timerId = setInterval(() => setNow(new Date()), 60000);
        return () => {
            unsubTopics(); unsubProposals(); unsubConfig(); clearInterval(timerId);
        };
    }, []);

    // 提案リセットロジック
    const checkAndResetProposals = async (lastResetISO) => {
        const currentTime = new Date();
        const targetResetTime = new Date(currentTime);
        const day = targetResetTime.getDay();
        const diff = (day + 6) % 7;
        targetResetTime.setDate(targetResetTime.getDate() - diff);
        targetResetTime.setHours(9, 0, 0, 0);

        if (currentTime < targetResetTime) {
            targetResetTime.setDate(targetResetTime.getDate() - 7);
        }

        const lastResetTime = lastResetISO ? new Date(lastResetISO).getTime() : 0;

        if (lastResetTime < targetResetTime.getTime()) {
            console.log("🔄 [Admin] 月曜9時リセット実行");
            // FirestoreからProposalsを削除する処理が必要だが、
            // ここではシステム設定の更新のみ行い、実際のデータ削除は手動またはFunctionsに任せるのが安全
            // (クライアントで大量削除を行うと負荷がかかるため)
            await setDoc(doc(db, "system", "config"), { lastProposalReset: new Date().toISOString() }, { merge: true });
        }
    };

    // 自動アーカイブ (Firestore対応版)
    // ※ 注意: Firestoreを使う場合、本来は「Cloud Functions」などのバックエンドで定期実行するのが正解です。
    // 管理画面を開いている人がいないと自動アーカイブされないためです。
    // ただ、個人開発レベルなら「管理者が画面を開いた瞬間にチェックして更新」でも運用可能です。
    // 自動アーカイブ
    useEffect(() => {
        if (adminTopics.length === 0) return;
        const currentNowTime = now.getTime();
        let hasChanges = false;

        adminTopics.forEach(async (t) => {
            if (t.status === 'published' && t.type !== 'archive' && t.endDate) {
                const endDate = new Date(t.endDate).getTime();
                if (currentNowTime > endDate) {
                    try {
                        await updateDoc(doc(db, "topics", t.topicId), { type: 'archive', status: 'archived' });
                    } catch (e) { console.error(e); }
                }
            }
        });
    }, [now, adminTopics]); // now更新時にチェック

    const currentPhaseInfo = PHASES.find(p => p.key === currentPhase);

    // フィルタリング
    const liveTopics = adminTopics.filter(t => t.type !== 'archive' && t.status === 'published');
    const pendingTopics = adminTopics.filter(t => t.type !== 'archive' && t.status === 'pending');
    const archivedTopics = adminTopics.filter(t => t.type === 'archive');

    const scheduledTopics = liveTopics.filter(t => new Date(t.startDate) > now);
    const activeTopics = liveTopics.filter(t => new Date(t.startDate) <= now);

    const officialLiveTopics = activeTopics.filter(t => t.type === 'official');
    const weeklyLiveTopics = activeTopics.filter(t => t.type === 'weekly');

    // ★ ユーザー投稿のソート & ページネーション ★
    const sortedProposals = [...userProposals].sort((a, b) => {
        if (proposalSortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const totalProposalPages = Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE);
    const displayedProposals = sortedProposals.slice(
        (proposalPage - 1) * PROPOSALS_PER_PAGE,
        proposalPage * PROPOSALS_PER_PAGE
    );

    return (
        <div className="flex justify-center">
            {/* レイアウトは既存のまま */}
            <div className="w-full max-w-4xl p-6 mx-auto relative">

                {/* 復活設定モーダル (中身のロジックは executeRestore でFirestore対応済み) */}
                {restoringTopic && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border-2 border-orange-400">
                            <h2 className="text-xl font-bold mb-4 text-orange-700 flex items-center gap-2">
                                🔄 アーカイブから復活させる
                            </h2>
                            <p className="mb-4 text-gray-700 font-bold bg-gray-100 p-2 rounded">
                                対象: {restoringTopic.title}
                            </p>

                            <div className="space-y-4">
                                <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                                    <p className="block text-sm font-bold text-orange-900 mb-2">開始オプション</p>

                                    <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded border border-orange-200 hover:bg-orange-50 transition">
                                        <input
                                            type="checkbox"
                                            checked={restoreMode === 'scheduled'}
                                            onChange={(e) => setRestoreMode(e.target.checked ? 'scheduled' : 'immediate')}
                                            className="w-5 h-5 accent-orange-600 cursor-pointer"
                                        />
                                        <span className="font-bold text-orange-900">予約投稿にする（次のお題予告に掲載）</span>
                                    </label>
                                    <p className="text-xs text-gray-600 pl-7">
                                        ※ チェックなしの場合は「即時復活（今すぐ公開）」になります。
                                    </p>

                                    {restoreMode === 'scheduled' && (
                                        <div className="pl-2 pt-2 space-y-3 border-t border-orange-200 mt-2">
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-gray-700">開始日時</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={restoreStartDate}
                                                        onChange={(e) => setRestoreStartDate(e.target.value)}
                                                        className="w-full p-2 border rounded"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={setRestoreAutoSchedule}
                                                        className="px-3 py-1 bg-orange-200 text-orange-900 text-xs font-bold rounded hover:bg-orange-300 whitespace-nowrap"
                                                    >
                                                        📅 自動セット
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold mb-1">終了日時 (再びアーカイブへ)</label>
                                    <input type="datetime-local" value={restoreEndDate} onChange={(e) => setRestoreEndDate(e.target.value)} className="w-full p-2 border rounded" />
                                    <p className="text-xs text-gray-500 mt-1">※ 指定した時間が来ると自動でアーカイブに戻ります。</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8 justify-end">
                                <button onClick={() => setRestoringTopic(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold">キャンセル</button>
                                <button onClick={executeRestore} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold shadow-md">復活を確定する</button>
                            </div>
                        </div>
                    </div>
                )}


                <h1 className="text-3xl font-bold mb-6 text-red-700 border-b pb-2 flex items-center gap-2">
                    ⚙️ 運営管理ダッシュボード
                </h1>

                {/* フェーズ表示・切替エリア */}
                <div className="p-4 rounded-lg shadow-md border border-red-300 bg-gray-50 mb-8">
                    <p className="text-sm font-bold text-gray-500 mb-2">現在の強制適用フェーズ</p>
                    <div className="flex items-center gap-4">
                        <div
                            className={`inline-flex items-center px-4 py-2 text-white rounded-lg text-lg font-bold shadow-sm
                                            ${currentPhase === 'voting' ? 'bg-blue-600' :
                                    currentPhase === 'public' ? 'bg-yellow-600' :
                                        currentPhase === 'blackout' ? 'bg-gray-600' :
                                            currentPhase === 'discussion' ? 'bg-green-600' : 'bg-red-600'}`}
                        >
                            {currentPhaseInfo ? currentPhaseInfo.label : '🤖 自動モード'}
                        </div>
                        <div className="text-sm text-gray-600">※ サイト全体に即時反映</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {PHASES.map((p) => (
                            <button key={p.key} onClick={() => setCurrentPhase(p.key)} className={`px-3 py-1.5 rounded-md font-medium text-sm transition duration-200 ${p.key === currentPhase ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>{p.label}</button>
                        ))}
                        <div className="w-px h-8 bg-gray-300 mx-2"></div>
                        <button onClick={() => setCurrentPhase('auto')} className={`px-3 py-1.5 rounded-md font-medium text-sm transition duration-200 ${currentPhase === 'auto' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>🤖 自動モード</button>
                        <button onClick={() => setOverridePhase(currentPhase)} className="ml-auto px-4 py-2 rounded-md font-bold bg-green-600 text-white hover:bg-green-700 shadow-sm">設定を適用 (リロード)</button>
                    </div>
                </div>

                <hr className="my-8 border-gray-300" />

                {/* 新規お題作成エリア */}
                <div className={`p-6 rounded-xl shadow-md border mb-12 ${editingTopicId ? 'bg-orange-50 border-orange-300' : 'bg-white border-indigo-200'}`}>
                    <h2 className={`text-2xl font-bold mb-4 flex items-center gap-2 ${editingTopicId ? 'text-orange-800' : 'text-indigo-900'}`}>
                        {editingTopicId ? '✏️ お題の編集' : '🆕 新規お題の作成・公開'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 公開設定エリア */}
                        <div className="bg-white/50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <label className="block text-sm font-bold mb-2 text-gray-800">公開モード</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 transition"><input type="radio" name="publishMode" value="immediate" checked={publishMode === 'immediate'} onChange={(e) => setPublishMode(e.target.value)} className="w-5 h-5" /><span className="font-medium">🚀 今すぐ公開</span></label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 transition"><input type="radio" name="publishMode" value="scheduled" checked={publishMode === 'scheduled'} onChange={(e) => setPublishMode(e.target.value)} className="w-5 h-5" /><span className="font-medium">📅 日時指定 / 予約</span></label>
                                </div>
                            </div>
                            <div className="w-full md:w-1/3">
                                <label className="block text-sm font-bold mb-2 text-gray-800">お題タイプ</label>
                                <select value={topicType} onChange={(e) => setTopicType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"><option value="weekly">📅 週替わりお題</option><option value="official">🏢 常設お題</option></select>
                            </div>
                        </div>

                        {/* 日時指定エリア (予約時 または 任意設定) */}
                        {(publishMode === 'scheduled' || editingTopicId) && (
                            <div className="flex gap-4 flex-wrap items-end bg-gray-50 p-3 rounded border border-gray-200">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-bold mb-1 text-gray-600">開始日時 {(!startDate && !editingTopicId) && '(自動: 次の月曜9時)'}</label>
                                    <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-bold mb-1 text-gray-600">終了日時 (自動: 開始から1週間後)</label>
                                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                {!editingTopicId && (
                                    <button type="button" onClick={setAutoSchedule} className="px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300 border border-gray-300">📅 自動セット</button>
                                )}
                            </div>
                        )}

                        {/* 入力フォーム */}
                        <div className="space-y-4">
                            <div><div className="font-bold text-sm text-gray-700 mb-1">タイトル (必須)</div><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 朝型？夜型？" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" /></div>
                            <div><div className="font-bold text-sm text-gray-700 mb-1">説明 (任意)</div><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細な説明..." className="w-full p-3 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" /></div>
                            <div>
                                <div className="font-bold text-sm text-gray-700 mb-2">選択肢 (2〜5個)</div>
                                <div className="space-y-2">
                                    {options.map((opt, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <input value={opt.prefix} onChange={(e) => handleOptionChange(index, 'prefix', e.target.value)} className="w-14 text-center p-2 border border-gray-300 rounded-lg bg-gray-50" />
                                            <input value={opt.text} onChange={(e) => handleOptionChange(index, 'text', e.target.value)} placeholder={`選択肢 ${index + 1}`} className="flex-1 p-2 border border-gray-300 rounded-lg" />
                                            {options.length > 2 && (
                                                <button type="button" onClick={() => removeOption(index)} className="p-2 text-gray-400 hover:text-red-500 transition">🗑️</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {options.length < 5 && (
                                    <button type="button" onClick={addOption} className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">➕ 選択肢を追加</button>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 flex gap-4">
                            <button type="submit" className={`flex-1 py-3 font-bold text-lg rounded-lg shadow-md transition transform hover:scale-[1.01] text-white ${editingTopicId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {editingTopicId ? '💾 更新を保存する' : (publishMode === 'scheduled' ? '📅 予約投稿する (予告へ)' : '🚀 今すぐ公開する')}
                            </button>
                            {editingTopicId && (
                                <button type="button" onClick={resetForm} className="px-6 py-3 font-bold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                                    キャンセル
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* 予約中のお題リスト */}
                {scheduledTopics.length > 0 && (
                    <div className="mb-8 p-4 border border-orange-300 bg-orange-50 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold mb-3 text-orange-800 flex items-center gap-2">
                            📅 公開予約中のお題 <span className="text-sm bg-white px-2 py-1 rounded-full border border-orange-200">{scheduledTopics.length}件</span>
                        </h2>
                        <div className="space-y-3">
                            {scheduledTopics.map(t => (
                                <div key={t.topicId} className="p-3 bg-white rounded-lg border border-orange-200 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-gray-800">{t.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">公開予定: <span className="font-mono font-bold text-orange-600">{new Date(t.startDate).toLocaleString()}</span></div>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* 予約中も編集可能に */}
                                        <button onClick={() => loadTopicForEdit(t)} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 shadow-sm">✏️ 編集</button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600 shadow-sm">中止</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 公開中のお題リスト */}
                <h2 className="text-2xl font-bold mt-8 mb-4 flex items-center gap-2 text-gray-800">
                    📡 公開中のお題 <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{activeTopics.length}件</span>
                </h2>

                <div className="space-y-6">
                    {/* --- 常設お題 --- */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 font-bold text-indigo-800">🏢 常設のお題 ({officialLiveTopics.length})</div>
                        <div className="divide-y divide-gray-100">
                            {officialLiveTopics.length > 0 ? officialLiveTopics.map(t => (
                                <div key={t.topicId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50">
                                    <div className="font-semibold text-gray-800">{t.title}</div>
                                    <div className="flex gap-2 shrink-0">
                                        {/* ★ 編集ボタンを追加 ★ */}
                                        <button onClick={() => loadTopicForEdit(t)} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 shadow-sm">✏️ 編集</button>
                                        <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="px-3 py-1.5 text-xs font-bold text-white bg-yellow-500 rounded-md hover:bg-yellow-600 shadow-sm">🚫 非公開</button>
                                        <button onClick={() => manualArchiveTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-gray-500 rounded-md hover:bg-gray-600 shadow-sm">📦 アーカイブ</button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600 shadow-sm">🗑️ 削除</button>
                                    </div>
                                </div>
                            )) : <div className="p-4 text-gray-400 text-sm text-center">公開中の常設お題はありません</div>}
                        </div>
                    </div>

                    {/* --- 週替わりお題 --- */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 font-bold text-blue-800">📅 週替わりのお題 ({weeklyLiveTopics.length})</div>
                        <div className="divide-y divide-gray-100">
                            {weeklyLiveTopics.length > 0 ? weeklyLiveTopics.map(t => (
                                <div key={t.topicId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50">
                                    <div>
                                        <div className="font-semibold text-gray-800">{t.title}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <span>期限: {new Date(t.endDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {/* ★ 編集ボタンを追加 ★ */}
                                        <button onClick={() => loadTopicForEdit(t)} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 shadow-sm">✏️ 編集</button>
                                        <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="px-3 py-1.5 text-xs font-bold text-white bg-yellow-500 rounded-md hover:bg-yellow-600 shadow-sm">🚫 非公開</button>
                                        <button onClick={() => manualArchiveTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-gray-500 rounded-md hover:bg-gray-600 shadow-sm">📦 アーカイブ</button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600 shadow-sm">🗑️ 削除</button>
                                    </div>
                                </div>
                            )) : <div className="p-4 text-gray-400 text-sm text-center">公開中の週替わりお題はありません</div>}
                        </div>
                    </div>
                </div>

                <hr className="my-8" />

                {/* 一時非公開 & アーカイブ & ユーザー投稿 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">👀 一時非公開 ({pendingTopics.length})</h2>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 min-h-[100px]">
                            {pendingTopics.length > 0 ? pendingTopics.map(t => (
                                <div key={t.topicId} className="flex justify-between items-center mb-3 p-3 bg-white rounded-lg shadow-sm border border-yellow-100">
                                    <span className="font-medium text-gray-800 truncate mr-2">{t.title}</span>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded">
                                            ✅ 再公開
                                        </button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded">
                                            🗑️ 削除
                                        </button>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-400 text-center py-4">データはありません</p>}
                        </div>
                    </div>

                    <hr className="my-8" />

                    {/* ★ ユーザー投稿お題候補エリア (採用ロジック) ★ */}
                    <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
                        <h2 className="text-xl font-bold mb-4 text-blue-900 flex items-center gap-2">
                            📢 ユーザー投稿お題候補 <span className="text-sm bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{userProposals.length}</span>
                        </h2>

                        {/* ソート＆ページネーション */}
                        <div className="flex justify-between items-center mb-4 text-sm">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setProposalSortBy('votes'); setProposalPage(1); }}
                                    className={`px-3 py-1 rounded-full border ${proposalSortBy === 'votes' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    いいね順
                                </button>
                                <button
                                    onClick={() => { setProposalSortBy('date'); setProposalPage(1); }}
                                    className={`px-3 py-1 rounded-full border ${proposalSortBy === 'date' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    新着順
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {displayedProposals.length > 0 ? displayedProposals.map(p => (
                                <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="font-bold text-gray-800">{p.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">👍 {p.votes} いいね | {new Date(p.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={() => loadProposalForEdit(p)} className="shrink-0 px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm">
                                        📝 編集フォームにロード
                                    </button>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center py-4">現在、候補はありません。</p>}
                        </div>


                        {/* ページネーションコントロール */}
                        {totalProposalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-6">
                                <button
                                    onClick={() => setProposalPage(prev => Math.max(1, prev - 1))}
                                    disabled={proposalPage === 1}
                                    className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    前へ
                                </button>
                                <span className="text-sm font-bold text-gray-700">{proposalPage} / {totalProposalPages}</span>
                                <button
                                    onClick={() => setProposalPage(prev => Math.min(totalProposalPages, prev + 1))}
                                    disabled={proposalPage === totalProposalPages}
                                    className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    次へ
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ★ アーカイブ管理エリアの追加 ★ */}
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">📦 アーカイブ管理 ({archivedTopics.length})</h2>
                        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 min-h-[100px]">
                            {archivedTopics.length > 0 ? archivedTopics.map(t => (
                                <div key={t.topicId} className="flex justify-between items-center mb-3 p-3 bg-white rounded-lg shadow-sm">
                                    <div className="overflow-hidden mr-2">
                                        <div className="font-medium text-gray-800 truncate">{t.title}</div>
                                        <div className="text-[10px] text-gray-400">終了: {new Date(t.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={() => handleRestoreClick(t)} className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-md hover:bg-orange-600 shadow-sm">
                                        🔄 復活
                                    </button>
                                    <button onClick={() => deleteTopic(t.topicId)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600 shadow-sm">
                                        🗑️ 削除
                                    </button>
                                </div>
                            )) : <p className="text-sm text-gray-400 text-center py-4">データはありません</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
}
