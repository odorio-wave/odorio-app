"use client";
import React, { useState, useEffect, useMemo } from 'react';
// 共通の設定ファイルを読み込む
import { db, auth } from "@/app/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import {
    collection, doc, setDoc, deleteDoc, onSnapshot, query, updateDoc
} from "firebase/firestore";

const ADMIN_EMAIL = "odorio.wave@gmail.com";

// データ保存場所を統一するためのID定数
const APP_ID = 'odorio-v1';

const PHASES = [
    { key: "voting", label: "🗳️ 投票フェーズ", color: "blue-600" },
    { key: "public", label: "📊 結果公開フェーズ", color: "yellow-600" },
    { key: "blackout", label: "🔒 非公開フェーズ", color: "gray-600" },
    { key: "discussion", label: "🗣️ 議論フェーズ", color: "green-600" },
];

// 日付入力欄用フォーマット関数
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
    d.setHours(9, 0, 0, 0);
    const day = d.getDay();
    let diff = (1 + 7 - day) % 7;
    if (diff === 0 && d.getTime() < Date.now()) {
        diff = 7;
    }
    d.setDate(d.getDate() + diff);
    return d;
};

// フェーズ設定保存関数
const setOverridePhase = async (phaseKey) => {
    try {
        const valueToSave = phaseKey === 'auto' ? null : phaseKey;
        await setDoc(doc(db, "system", "config"), {
            phaseMode: valueToSave
        }, { merge: true });
        alert(`設定を「${phaseKey}」に変更しました。`);
    } catch (error) {
        console.error("エラー:", error);
        alert("権限がありません。（正しい管理者アカウントでログインしていますか？）");
    }
};

// 1. 折りたたみ用コンポーネントを定義 (AdminControl関数の中でOK)
const CollapsibleSection = ({ title, count, color, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // 色設定マップ
    const theme = {
        orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-800', headerBg: 'bg-orange-100' },
        indigo: { border: 'border-indigo-200', bg: 'bg-white', text: 'text-indigo-800', headerBg: 'bg-indigo-50' },
        blue: { border: 'border-blue-200', bg: 'bg-white', text: 'text-blue-800', headerBg: 'bg-blue-50' },
        yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-800', headerBg: 'bg-yellow-100' },
        purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-900', headerBg: 'bg-purple-100' },
        gray: { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-700', headerBg: 'bg-gray-200' },
    }[color] || { border: 'border-gray-200', bg: 'bg-white', text: 'text-gray-800', headerBg: 'bg-gray-100' };

    return (
        <div className={`mb-6 rounded-xl border shadow-sm overflow-hidden ${theme.border} ${theme.bg}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${theme.headerBg} hover:opacity-90`}
            >
                <div className={`flex items-center gap-3 font-bold text-lg ${theme.text}`}>
                    {title}
                    {count !== undefined && (
                        <span className="bg-white/80 px-2 py-0.5 rounded-full text-sm shadow-sm border border-black/5">
                            {count}
                        </span>
                    )}
                </div>
                <div className={`text-2xl transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                    ▼
                </div>
            </button>

            {/* 開閉アニメーション (簡易的) */}
            {isOpen && (
                <div className="p-4 border-t border-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export default function AdminControl() {
    // --- 認証用 State ---
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPass, setLoginPass] = useState("");

    // --- 管理用 State (フェーズ) ---
    // savedPhase: DBに保存されている現在の値
    const [savedPhase, setSavedPhase] = useState('auto');
    // selectedPhase: UIで選択中の値（まだ保存されていない）
    const [selectedPhase, setSelectedPhase] = useState('auto');

    // --- その他の State ---
    const [userProposals, setUserProposals] = useState([]);
    const [adminTopics, setAdminTopics] = useState([]);
    const [now, setNow] = useState(new Date());

    // 編集中のトピックID (nullなら新規作成モード)
    const [editingTopicId, setEditingTopicId] = useState(null);

    // 新規お題作成フォームの状態
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState([
        { id: 'opt_initial_1', prefix: '1.', text: '' },
        { id: 'opt_initial_2', prefix: '2.', text: '' },
    ]);
    const [topicType, setTopicType] = useState('weekly');

    // 公開設定
    const [publishMode, setPublishMode] = useState('scheduled');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // 復活モーダル用の状態
    const [restoringTopic, setRestoringTopic] = useState(null);
    const [restoreStartDate, setRestoreStartDate] = useState('');
    const [restoreEndDate, setRestoreEndDate] = useState('');
    const [restoreMode, setRestoreMode] = useState('immediate');

    // お題候補のページネーションとソート用 State
    const [proposalPage, setProposalPage] = useState(1);
    const [proposalSortBy, setProposalSortBy] = useState('votes');
    const PROPOSALS_PER_PAGE = 10;

    // --- 認証ロジック ---
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user && user.email === ADMIN_EMAIL) {
                setIsAdminUser(true);
            } else {
                setIsAdminUser(false);
            }
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPass);
        } catch (error) {
            alert("ログイン失敗: メールアドレスかパスワードが違います");
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.reload();
    };

    // --- データ監視 (ログイン済みの場合のみ) ---
    useEffect(() => {
        if (!isAdminUser) return;

        const currentNow = new Date();
        setNow(currentNow);
        setStartDate(toLocalISOString(currentNow));
        setEndDate(toLocalISOString(new Date(currentNow.getTime() + 7 * 86400000)));

        const unsubTopics = onSnapshot(query(collection(db, "topics")), (snapshot) => {
            const list = snapshot.docs.map((d) => d.data());
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAdminTopics(list);
        });

        const unsubProposals = onSnapshot(query(collection(db, "proposals")), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            setUserProposals(list);
        });

        // システム設定（フェーズ）の監視
        const unsubConfig = onSnapshot(doc(db, "system", "config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const mode = data.phaseMode || 'auto';
                setSavedPhase(mode);    // DBの値をセット
                setSelectedPhase(mode); // 初期選択状態もDBに合わせる
            } else {
                setSavedPhase('auto');
                setSelectedPhase('auto');
            }
        });

        const timerId = setInterval(() => setNow(new Date()), 60000);
        return () => {
            unsubTopics(); unsubProposals(); unsubConfig(); clearInterval(timerId);
        };
    }, [isAdminUser]);

    // --- ヘルパー関数 ---
    const resetForm = () => {
        setTitle(''); setDescription('');
        setOptions([{ id: `opt_r1`, prefix: '1.', text: '' }, { id: `opt_r2`, prefix: '2.', text: '' }]);
        setEditingTopicId(null);
        setPublishMode('scheduled');
    };

    const handleOptionChange = (index, field, value) => {
        setOptions(prev => prev.map((opt, i) => i === index ? { ...opt, [field]: value } : opt));
    };
    const addOption = () => options.length < 5 && setOptions([...options, { id: `opt_new_${Date.now()}`, prefix: (options.length + 1) + '.', text: '' }]);
    const removeOption = (index) => {
        if (options.length > 2) setOptions(options.filter((_, i) => i !== index).map((opt, i) => ({ ...opt, prefix: `${i + 1}.` })));
    };
    const setAutoSchedule = () => {
        const nextMon = getNextMonday9AM();
        const nextNextMon = new Date(nextMon); nextNextMon.setDate(nextNextMon.getDate() + 7);
        setStartDate(toLocalISOString(nextMon)); setEndDate(toLocalISOString(nextNextMon));
    };
    const setRestoreAutoSchedule = () => {
        const nextMon = getNextMonday9AM();
        const nextNextMon = new Date(nextMon); nextNextMon.setDate(nextNextMon.getDate() + 7);
        setRestoreStartDate(toLocalISOString(nextMon)); setRestoreEndDate(toLocalISOString(nextNextMon));
        setRestoreMode('scheduled');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.text.trim());
        if (!title.trim() || validOptions.length < 2) return alert("タイトルと2つ以上の選択肢が必要です");

        let finalStart = startDate; let finalEnd = endDate;
        if (publishMode === 'scheduled') {
            if (!finalStart) finalStart = toLocalISOString(getNextMonday9AM());
            if (!finalEnd) { const d = new Date(finalStart); d.setDate(d.getDate() + 7); finalEnd = toLocalISOString(d); }
        } else {
            finalStart = toLocalISOString(new Date());
            if (!finalEnd) finalEnd = topicType === 'weekly' ? toLocalISOString(new Date(Date.now() + 7 * 86400000)) : '2099-12-31T23:59:59';
        }

        const topicIdToSave = editingTopicId || `adm_${Date.now()}`;

        // 1. 基本オブジェクト作成
        const newTopic = {
            topicId: topicIdToSave,
            title: title.trim(),
            description: description.trim(),
            options: validOptions,
            type: topicType,
            status: 'published',
            createdAt: editingTopicId ? (adminTopics.find(t => t.topicId === editingTopicId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            startDate: new Date(finalStart).toISOString(),
            endDate: new Date(finalEnd).toISOString(),
        };

        // 2. 新規作成時のみ votes を初期化 (編集時に消さないため)
        if (!editingTopicId) {
            newTopic.votes = {};
        }

        try {
            await setDoc(doc(db, "topics", topicIdToSave), JSON.parse(JSON.stringify(newTopic)), { merge: true });
            alert(editingTopicId ? "更新しました！" : "作成しました！");
            resetForm();
        } catch (e) { alert("保存エラー (権限がありません)"); }
    };

    const loadTopicForEdit = (topic) => {
        if (!confirm("編集しますか？")) return;
        setEditingTopicId(topic.topicId); setTitle(topic.title); setDescription(topic.description);
        setOptions(topic.options.map((opt) => ({ ...opt })));
        setTopicType(topic.type);
        setStartDate(toLocalISOString(new Date(topic.startDate))); setEndDate(toLocalISOString(new Date(topic.endDate)));
        setPublishMode('scheduled'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const loadProposalForEdit = (proposal) => {
        if (!confirm("これをベースに新規作成しますか？")) return;
        setEditingTopicId(null); setTitle(proposal.title); setDescription(proposal.description || '');
        setOptions(proposal.options.map((opt, i) => ({ id: `p_${i}`, prefix: `${i + 1}.`, text: opt.text })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteTopic = async (id) => { if (confirm("削除しますか？")) await deleteDoc(doc(db, "topics", id)); };
    const togglePublishTopic = async (id, status) => await updateDoc(doc(db, "topics", id), { status: status === 'published' ? 'pending' : 'published' });
    // アーカイブボタンの処理
    const manualArchiveTopic = async (id) => {
        if (!confirm("アーカイブしますか？\n（常設の場合は過去ログを作成し、本体をリセットします）")) return;

        try {
            // 対象のお題を取得
            const topic = adminTopics.find(t => t.topicId === id);
            if (!topic) return;

            // 常設お題の場合 (特殊処理)
            if (topic.type === 'official') {
                // 1. 過去ログ（アーカイブデータ）を作成
                const archiveId = `${topic.topicId}_${Math.floor(Date.now() / 1000)}`;
                const archiveData = {
                    ...topic,
                    id: archiveId,
                    topicId: archiveId,
                    type: 'archive',           // タイプはアーカイブ
                    status: 'archived',        // ステータスはアーカイブ
                    originalEndpointId: topic.topicId, // 元のIDを紐付け
                    title: `${topic.title} (過去ログ)`,
                    archiveType: 'official',   // 元は常設だったと記録
                    votes: topic.votes || {},
                    archiveLikes: []
                };

                // 新しいドキュメントとして保存
                await setDoc(doc(db, "topics", archiveId), archiveData);

                // 2. 本体をリセット (期間更新 & 票リセット)
                const nextEndDate = new Date();
                nextEndDate.setDate(nextEndDate.getDate() + 7); // 次の期間へ（例: 7日後）

                await updateDoc(doc(db, "topics", topic.topicId), {
                    startDate: new Date().toISOString(),
                    endDate: nextEndDate.toISOString(),
                    votes: {},       // 票をリセット
                    type: 'official' // 本体は常設のまま維持
                });

                alert("常設お題をアーカイブ化（過去ログ作成・本体リセット）しました");
            }

            // 週替わり・その他のお題の場合 (通常処理)
            else {
                // そのままステータスを更新して終了
                await updateDoc(doc(db, "topics", id), {
                    status: 'archived',
                    type: 'archive',
                    archiveType: 'weekly' // 週替わりとして記録
                });
                alert("アーカイブしました");
            }

        } catch (e) {
            console.error(e);
            alert("エラーが発生しました: " + e.message);
        }
    };

    const handleRestoreClick = (t) => {
        setRestoringTopic(t);
        setRestoreStartDate(toLocalISOString(new Date()));
        setRestoreEndDate(toLocalISOString(getNextMonday9AM()));
        setRestoreMode('immediate');
    };
    const executeRestore = async () => {
        if (!restoringTopic) return;
        let start = restoreStartDate;
        if (restoreMode === 'immediate') start = new Date().toISOString();
        await setDoc(doc(db, "topics", restoringTopic.topicId), {
            type: restoringTopic.originalEndpointId ? 'official' : 'weekly', status: 'published',
            startDate: new Date(start).toISOString(), endDate: new Date(restoreEndDate).toISOString()
        }, { merge: true });
        alert("復活しました"); setRestoringTopic(null);
    };

    // 表示用データの計算
    const savedPhaseInfo = PHASES.find(p => p.key === savedPhase);
    const liveTopics = adminTopics.filter(t => t.type !== 'archive' && t.status === 'published');
    const pendingTopics = adminTopics.filter(t => t.type !== 'archive' && t.status === 'pending');
    const archivedTopics = adminTopics.filter(t => t.type === 'archive');
    const [archiveFilter, setArchiveFilter] = useState('all');
    const [archiveSort, setArchiveSort] = useState('date');
    const scheduledTopics = liveTopics.filter(t => new Date(t.startDate) > now);
    const activeTopics = liveTopics.filter(t => new Date(t.startDate) <= now);
    const officialLiveTopics = activeTopics.filter(t => t.type === 'official');
    const weeklyLiveTopics = activeTopics.filter(t => t.type === 'weekly');

    const sortedProposals = [...userProposals].sort((a, b) => {
        if (proposalSortBy === 'votes') return (b.votes || 0) - (a.votes || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const totalProposalPages = Math.ceil(sortedProposals.length / PROPOSALS_PER_PAGE);
    const displayedProposals = sortedProposals.slice((proposalPage - 1) * PROPOSALS_PER_PAGE, proposalPage * PROPOSALS_PER_PAGE);

    // フィルタ・ソート済みのアーカイブリストを計算 (useMemo)
    const displayedArchives = useMemo(() => {
        let data = [...archivedTopics];

        // A. フィルタリング
        if (archiveFilter !== 'all') {
            data = data.filter(t => {
                // JSなので型アサーション(as any)は不要。直接アクセスします。
                // 新しいデータは archiveType で判定
                if (t.archiveType) {
                    return t.archiveType === archiveFilter;
                }
                // 古いデータの自動判別
                const isLikelyOfficial = t.title.includes("(過去ログ)");

                if (archiveFilter === 'official') return isLikelyOfficial;
                return !isLikelyOfficial; // weeklyの場合は常設以外
            });
        }

        // B. ソート
        data.sort((a, b) => {
            if (archiveSort === 'likes') {
                // いいね数 (archiveLikesの配列長) で降順
                // オプショナルチェーン (?.) は最近のJSなら使えます
                const likesA = a.archiveLikes?.length || 0;
                const likesB = b.archiveLikes?.length || 0;
                return likesB - likesA;
            }
            // 日付順
            return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
        });

        return data;
    }, [archivedTopics, archiveFilter, archiveSort]);



    // ★★★ 認証チェック画面 ★★★
    if (authLoading) return <div className="p-10 text-center">認証確認中...</div>;

    if (!isAdminUser) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-100">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">👑 管理者ログイン</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="admin@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={loginPass}
                                onChange={e => setLoginPass(e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="********"
                            />
                        </div>
                        <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">
                            ログイン
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ★★★ ログイン済みなら管理画面を表示 ★★★
    return (
        <div className="flex justify-center bg-gray-50 min-h-screen">
            <div className="w-full max-w-4xl p-6 mx-auto relative bg-white shadow-xl min-h-screen">

                {/* ログアウトボタン */}
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={handleLogout} className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded shadow-sm border border-gray-300">
                        🚪 ログアウト
                    </button>
                </div>

                {/* --- 復活モーダル --- */}
                {restoringTopic && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border-2 border-orange-400">
                            <h2 className="text-xl font-bold mb-4">🔄 復活: {restoringTopic.title}</h2>
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 bg-orange-50 p-3 rounded cursor-pointer">
                                    <input type="checkbox" checked={restoreMode === 'scheduled'} onChange={e => setRestoreMode(e.target.checked ? 'scheduled' : 'immediate')} />
                                    <span className="font-bold">予約投稿にする（予告へ）</span>
                                </label>
                                {restoreMode === 'scheduled' && (
                                    <div className="flex gap-2">
                                        <input type="datetime-local" value={restoreStartDate} onChange={e => setRestoreStartDate(e.target.value)} className="border p-2 rounded flex-1" />
                                        <button onClick={setRestoreAutoSchedule} className="bg-orange-200 px-2 rounded text-xs">自動</button>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold block mb-1">終了日時</label>
                                    <input type="datetime-local" value={restoreEndDate} onChange={e => setRestoreEndDate(e.target.value)} className="w-full border p-2 rounded" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setRestoringTopic(null)} className="bg-gray-200 px-4 py-2 rounded">中止</button>
                                <button onClick={executeRestore} className="bg-orange-500 text-white px-4 py-2 rounded font-bold">復活確定</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- メインコンテンツ --- */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black mb-6 text-gray-800 flex items-center gap-3 border-b-4 border-red-500 pb-2">
                        <span>⚙️</span> 運営管理ダッシュボード
                    </h1>

                    {/* フェーズ切替 (重要なので常時表示) */}
                    <div className="p-5 rounded-xl shadow-md border-2 border-red-100 bg-white">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 mb-1">現在の強制適用フェーズ</p>
                                <div className={`inline-flex items-center px-4 py-1.5 text-white rounded-lg text-lg font-bold shadow-sm
                                    ${savedPhase === 'voting' ? 'bg-blue-600' : savedPhase === 'public' ? 'bg-yellow-600' : savedPhase === 'blackout' ? 'bg-gray-600' : savedPhase === 'discussion' ? 'bg-green-600' : 'bg-red-600'}`}>
                                    {savedPhaseInfo ? savedPhaseInfo.label : '🤖 自動モード'}
                                </div>
                            </div>
                            <button onClick={() => setOverridePhase(selectedPhase)} className="px-6 py-2 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 shadow-lg transform active:scale-95 transition">
                                ✅ 設定を適用
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-lg">
                            {PHASES.map((p) => (
                                <button key={p.key} onClick={() => setSelectedPhase(p.key)}
                                    className={`px-3 py-1.5 rounded-md font-bold text-sm transition ${selectedPhase === p.key ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200' : 'text-gray-500 hover:bg-gray-200'}`}>
                                    {p.label}
                                </button>
                            ))}
                            <div className="w-px h-6 bg-gray-300 mx-2 self-center"></div>
                            <button onClick={() => setSelectedPhase('auto')}
                                className={`px-3 py-1.5 rounded-md font-bold text-sm transition ${selectedPhase === 'auto' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                                🤖 自動モード
                            </button>
                        </div>
                    </div>
                </div>

                {/* 新規作成フォーム */}
                <div className={`p-6 rounded-xl shadow-md border-2 mb-10 transition-colors ${editingTopicId ? 'bg-orange-50 border-orange-300' : 'bg-white border-indigo-100'}`}>
                    <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${editingTopicId ? 'text-orange-800' : 'text-indigo-900'}`}>
                        {editingTopicId ? '✏️ お題を編集モード' : '🆕 新しいお題を作成'}
                    </h2>
                    {/* フォームの中身は既存のコードを使用 */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* ...フォームの中身は変更なし... */}
                        {/* 省略せずに元のフォームコードをここに配置してください */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="flex gap-2 text-sm bg-gray-50 p-2 rounded border">
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={publishMode === 'immediate'} onChange={() => setPublishMode('immediate')} />即時公開</label>
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={publishMode === 'scheduled'} onChange={() => setPublishMode('scheduled')} />予約</label>
                                    <div className="w-px h-4 bg-gray-300 mx-2"></div>
                                    <select value={topicType} onChange={e => setTopicType(e.target.value)} className="bg-transparent font-bold"><option value="weekly">週替わり</option><option value="official">常設</option></select>
                                </div>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル (必須)" className="w-full p-2 border rounded font-bold" />
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="説明" className="w-full p-2 border rounded h-16 text-sm" />
                            </div>
                            <div className="md:w-1/3 space-y-2">
                                <div className="bg-gray-50 p-2 rounded border text-sm h-full overflow-y-auto max-h-48">
                                    <p className="font-bold text-gray-500 mb-1">選択肢</p>
                                    {options.map((opt, i) => (
                                        <div key={i} className="flex gap-1 mb-1">
                                            <input value={opt.prefix} onChange={e => handleOptionChange(i, 'prefix', e.target.value)} className="w-8 p-1 border rounded text-center" />
                                            <input value={opt.text} onChange={e => handleOptionChange(i, 'text', e.target.value)} className="flex-1 p-1 border rounded" placeholder={`選択肢${i + 1}`} />
                                            {options.length > 2 && <button type="button" onClick={() => removeOption(i)} className="text-red-500 px-1">×</button>}
                                        </div>
                                    ))}
                                    {options.length < 5 && <button type="button" onClick={addOption} className="text-blue-600 text-xs font-bold block mt-1">+ 追加</button>}
                                </div>
                            </div>
                        </div>
                        {(publishMode === 'scheduled' || editingTopicId) && (
                            <div className="flex gap-2 text-xs items-end bg-yellow-50 p-2 rounded border border-yellow-200">
                                <div><label>開始</label><input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded block" /></div>
                                <div><label>終了</label><input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded block" /></div>
                                {!editingTopicId && <button type="button" onClick={setAutoSchedule} className="bg-orange-200 px-2 py-1 rounded font-bold">自動</button>}
                            </div>
                        )}
                        <div className="flex gap-2 pt-2">
                            <button type="submit" className={`flex-1 py-2 font-bold text-white rounded shadow-sm ${editingTopicId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {editingTopicId ? '更新保存' : (publishMode === 'scheduled' ? '予約投稿する' : '公開する')}
                            </button>
                            {editingTopicId && <button type="button" onClick={resetForm} className="px-4 bg-gray-200 font-bold rounded">キャンセル</button>}
                        </div>
                    </form>
                </div>


                {/* ▼▼▼ ここから折りたたみセクション ▼▼▼ */}

                {/* 1. 予約中 (あれば自動で開く) */}
                {scheduledTopics.length > 0 && (
                    <CollapsibleSection title="📅 予約中のお題" count={scheduledTopics.length} color="orange" defaultOpen={true}>
                        <div className="grid gap-2">
                            {scheduledTopics.map(t => (
                                <div key={t.topicId} className="flex justify-between items-center bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                                    <div>
                                        <span className="font-bold text-gray-800">{t.title}</span>
                                        <div className="text-xs text-orange-600 mt-1 font-mono">公開: {new Date(t.startDate).toLocaleString()}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => loadTopicForEdit(t)} className="bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold rounded">編集</button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="bg-red-100 text-red-700 px-3 py-1 text-xs font-bold rounded">削除</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                )}

                {/* 2. 常設 (デフォルト開) */}
                <CollapsibleSection title="🏢 常設のお題" count={officialLiveTopics.length} color="indigo" defaultOpen={true}>
                    <div className="space-y-2">
                        {officialLiveTopics.length > 0 ? officialLiveTopics.map(t => (
                            <div key={t.topicId} className="p-3 bg-white border border-indigo-100 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
                                <div>
                                    <div className="font-bold text-gray-800">{t.title}</div>
                                    <div className="text-xs text-gray-400">ID: {t.topicId}</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => loadTopicForEdit(t)} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded border border-blue-100">編集</button>
                                    <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="px-2 py-1 bg-yellow-50 text-yellow-600 text-xs font-bold rounded border border-yellow-100">非公開</button>
                                    <button onClick={() => manualArchiveTopic(t.topicId)} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded border border-gray-100">アーカイブ</button>
                                    <button onClick={() => deleteTopic(t.topicId)} className="px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100">削除</button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-400 text-sm">現在ありません</p>}
                    </div>
                </CollapsibleSection>

                {/* 3. 週替わり (デフォルト開) */}
                <CollapsibleSection title="📅 週替わりのお題" count={weeklyLiveTopics.length} color="blue" defaultOpen={true}>
                    <div className="space-y-2">
                        {weeklyLiveTopics.length > 0 ? weeklyLiveTopics.map(t => (
                            <div key={t.topicId} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
                                <div>
                                    <div className="font-bold text-gray-800">{t.title}</div>
                                    <div className="text-xs text-blue-500 font-bold">期限: {new Date(t.endDate).toLocaleDateString()}</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => loadTopicForEdit(t)} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded border border-blue-100">編集</button>
                                    <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="px-2 py-1 bg-yellow-50 text-yellow-600 text-xs font-bold rounded border border-yellow-100">非公開</button>
                                    <button onClick={() => manualArchiveTopic(t.topicId)} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded border border-gray-100">アーカイブ</button>
                                    <button onClick={() => deleteTopic(t.topicId)} className="px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100">削除</button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-400 text-sm">現在ありません</p>}
                    </div>
                </CollapsibleSection>

                {/* 4. お題候補 (デフォルト開) */}
                <CollapsibleSection title="📢 ユーザー投稿のお題候補" count={userProposals.length} color="purple" defaultOpen={true}>
                    {/* ソートボタン */}
                    <div className="flex gap-2 mb-3 text-xs justify-end">
                        <button
                            type="button"
                            onClick={() => setProposalSortBy('votes')}
                            className={`px-2 py-1 rounded ${proposalSortBy === 'votes' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
                        >
                            いいね順
                        </button>
                        <button
                            type="button"
                            onClick={() => setProposalSortBy('date')}
                            className={`px-2 py-1 rounded ${proposalSortBy === 'date' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
                        >
                            新着順
                        </button>
                    </div>

                    <div className="space-y-2">
                        {displayedProposals.length > 0 ? displayedProposals.map(p => (
                            <div key={p.id} className="p-3 bg-white border border-purple-100 rounded-lg shadow-sm flex justify-between items-center gap-2">
                                <div className="min-w-0">
                                    <div className="font-bold text-gray-800 truncate">{p.title}</div>
                                    <div className="text-xs text-gray-500">👍 {p.votes} | {new Date(p.createdAt).toLocaleDateString()}</div>
                                </div>
                                <button onClick={() => loadProposalForEdit(p)} className="shrink-0 px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm">
                                    この内容で作成
                                </button>
                            </div>
                        )) : <p className="text-center text-gray-400 text-sm">候補はありません</p>}
                    </div>
                    {/* ページネーション (既存ロジック) */}
                    {totalProposalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-4 text-xs">
                            <button disabled={proposalPage === 1} onClick={() => setProposalPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-50">前へ</button>
                            <span className="py-1">{proposalPage} / {totalProposalPages}</span>
                            <button disabled={proposalPage === totalProposalPages} onClick={() => setProposalPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-50">次へ</button>
                        </div>
                    )}
                </CollapsibleSection>

                {/* 5. 一時非公開 (デフォルト閉) */}
                <CollapsibleSection title="👀 非公開・保留中" count={pendingTopics.length} color="yellow" defaultOpen={false}>
                    <div className="space-y-2">
                        {pendingTopics.length > 0 ? pendingTopics.map(t => (
                            <div key={t.topicId} className="flex justify-between items-center p-3 bg-white border border-yellow-200 rounded-lg">
                                <span className="font-medium text-gray-700">{t.title}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => togglePublishTopic(t.topicId, t.status)} className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded">再公開</button>
                                    <button onClick={() => deleteTopic(t.topicId)} className="px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded">削除</button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-400 text-sm">ありません</p>}
                    </div>
                </CollapsibleSection>

                {/* 6. アーカイブ (デフォルト閉) */}
                <CollapsibleSection title="📦 アーカイブ (終了分)" count={archivedTopics.length} color="gray" defaultOpen={false}>

                    {/* ▼▼▼ ツールバーエリア ▼▼▼ */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 text-xs">

                        {/* フィルタ切り替え */}
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setArchiveFilter('all')}
                                className={`px-3 py-1.5 rounded-md font-bold transition ${archiveFilter === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                すべて
                            </button>
                            <button
                                type="button"
                                onClick={() => setArchiveFilter('official')}
                                className={`px-3 py-1.5 rounded-md font-bold transition ${archiveFilter === 'official' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                常設
                            </button>
                            <button
                                type="button"
                                onClick={() => setArchiveFilter('weekly')}
                                className={`px-3 py-1.5 rounded-md font-bold transition ${archiveFilter === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                週替わり
                            </button>
                        </div>

                        {/* ソート切り替え */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setArchiveSort('date')}
                                className={`px-3 py-1.5 rounded-md border font-bold transition ${archiveSort === 'date' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                📅 日付順
                            </button>
                            <button
                                type="button"
                                onClick={() => setArchiveSort('likes')}
                                className={`px-3 py-1.5 rounded-md border font-bold transition ${archiveSort === 'likes' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                ❤️ 人気順
                            </button>
                        </div>
                    </div>

                    {/* リスト表示エリア */}
                    <div className="max-h-96 overflow-y-auto pr-1 space-y-2">
                        {displayedArchives.length > 0 ? displayedArchives.map(t => {
                            // JSなので直接アクセス
                            const likeCount = t.archiveLikes?.length || 0;
                            const isOfficial = t.archiveType === 'official' || t.title.includes("(過去ログ)");

                            return (
                                <div key={t.topicId} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                                    <div className="min-w-0 mr-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            {/* 種別バッジ */}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isOfficial ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                {isOfficial ? '常設' : '週替'}
                                            </span>
                                            <div className="font-medium text-gray-700 truncate">{t.title}</div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            <span>終了: {new Date(t.endDate).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-0.5 text-pink-400 font-bold">
                                                ❤️ {likeCount}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => handleRestoreClick(t)} className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded hover:bg-orange-600 shadow-sm">復活</button>
                                        <button onClick={() => deleteTopic(t.topicId)} className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded hover:bg-red-600 shadow-sm">削除</button>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <p className="text-sm text-gray-400">該当するアーカイブはありません</p>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

            </div>
        </div>
    );
}