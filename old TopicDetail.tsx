"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

// カスタムカラーパレットの定義
const COLORS = {
    YES_BUTTON: "bg-blue-600 hover:bg-blue-700",
    NO_BUTTON: "bg-purple-600 hover:bg-purple-700",
    REVOTE_BUTTON: "bg-orange-500 hover:bg-orange-600",
    REVOTE_AREA_BG: "bg-orange-50",
    YES_TEXT: "text-blue-700",
    NO_TEXT: "text-purple-700",
    REVOTER_MARK: "text-orange-600",
    LIKE_BUTTON: "text-gray-500 hover:text-red-500",
    LIKED: "text-red-500",
    QUOTE_TEXT: "text-gray-600 italic",
    VOTED_ACTIVE: "ring-4 ring-offset-2 ring-yellow-400/80"
}

// 開発/議論フェーズのシミュレーション定数 (管理画面導入までの代替)
const DUMMY_PHASE_KEY = "voting";

// --- 型定義 (変更なし) ---
type Reason = {
    text: string;
    timestamp: string;
    userId: string;
    isReVoter: boolean;
    likes: number;
    likedBy: string[];
    reports: number;
    isHidden: boolean;
};
type Reasons = { yes: Reason[]; }; // 賛成理由のみ

type Comment = {
    text: string;
    timestamp: string;
    quoteNumber?: number;
    reports: number;
    isHidden: boolean;
    userVoteChoice?: "yes" | "no";
};
// --- 型定義ここまで ---


export default function TopicDetail() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();

    // ユーザー識別IDの取得
    const getLocalId = () => {
        let uid = localStorage.getItem('user-local-id');
        if (!uid) {
            uid = Math.random().toString(36).substring(2, 9);
            localStorage.setItem("site_userid_v1", uid);
        }
        return uid;
    };
    const localUserId = getLocalId();
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    // ★ フェーズの取得 (シミュレーション) ★
    const DUMMY_PHASE_KEY = "voting";
    const currentPhase = DUMMY_PHASE_KEY as string;
    const isVotingPhase = currentPhase === "voting";
    const isDiscussionPhase = currentPhase === "discussion";

    // 状態管理
    const [votes, setVotes] = useState({ yes: 0, no: 0 });
    const [hasVoted, setHasVoted] = useState(false);
    const [voteChoice, setVoteChoice] = useState<"yes" | "no" | null>(null);
    const [isReVoter, setIsReVoter] = useState(false);
    const [reason, setReason] = useState("");
    const [requireReason, setRequireReason] = useState(false);
    const [reasons, setReasons] = useState<Reasons>({ yes: [] });
    const [sortBy, setSortBy] = useState<"newest" | "likes">("newest");
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [quoteNumber, setQuoteNumber] = useState<number | null>(null);
    const [commentPage, setCommentPage] = useState(1);
    const COMMENTS_PER_PAGE = 100;

    // === データ操作と保存関数 === 
    const saveVotes = (newVotes: typeof votes) => {
        localStorage.setItem(`votes-${id}`, JSON.stringify(newVotes));
        setVotes(newVotes);
    };
    const saveReasons = (newReasons: typeof reasons) => {
        localStorage.setItem(`vote-reasons-${id}`, JSON.stringify(newReasons));
        setReasons(newReasons);
    };
    const saveIsReVoter = (value: boolean) => {
        localStorage.setItem(`is-re-voter-${id}`, JSON.stringify(value));
        setIsReVoter(value);
    }
    const saveComments = (newComments: Comment[]) => {
        localStorage.setItem(`comments-${id}`, JSON.stringify(newComments));
        setComments(newComments);
    };

    // 初期化：localStorageから復元 (修正済み)
    useEffect(() => {
        const savedVotes = localStorage.getItem(`votes-${id}`);
        if (savedVotes) setVotes(JSON.parse(savedVotes));

        const savedChoice = localStorage.getItem(`vote-choice-${id}`);
        if (savedChoice) {
            setVoteChoice(savedChoice as "yes" | "no");
            setHasVoted(true);
        }

        const savedComments = localStorage.getItem(`comments-${id}`);
        if (savedComments) {
            const initializeComment = (c: any): Comment => ({
                ...c,
                reports: c.reports ?? 0,
                isHidden: c.isHidden ?? false,
                userVoteChoice: c.userVoteChoice // 復元
            });
            setComments(JSON.parse(savedComments).map(initializeComment));
        }

        const savedIsReVoter = localStorage.getItem(`is-re-voter-${id}`);
        if (savedIsReVoter) setIsReVoter(JSON.parse(savedIsReVoter));

        // Reasonの復元 (完全版コードを反映)
        const savedReasons = localStorage.getItem(`vote-reasons-${id}`);
        if (savedReasons) {
            try {
                const loadedReasons: any = JSON.parse(savedReasons);
                const initializeReason = (r: any): Reason => ({
                    ...r,
                    likes: r.likes ?? 0,
                    likedBy: r.likedBy ?? [],
                    reports: r.reports ?? 0,
                    isHidden: r.isHidden ?? false,
                });
                setReasons({ yes: (loadedReasons.yes || []).map(initializeReason) });
            } catch (e) {
                setReasons({ yes: [] });
            }
        }

    }, [id]);


    // === 投票ロジック ===

    const handleVote = (choice: "yes" | "no") => {
        // 共通の確認ステップ
        const confirmMessage = isDiscussionPhase
            ? `【議論参加】\nあなたは「${choice === 'yes' ? '賛成' : '反対'}」派として、議論に参加します。\nこの投票は集計に影響せず、後で変更できません。よろしいですか？`
            : `【投票】\n本当に「${choice === 'yes' ? '賛成' : '反対'}」に投票しますか？\nこの投票は集計されます。`;

        if (!confirm(confirmMessage)) {
            return;
        }

        if (choice === 'no') {
            alert("現在、反対理由の投稿は受け付けておりません。投票のみ可能です。");
        }

        if (!hasVoted) {
            // 初回投票
            let newVotes = { ...votes };

            if (isVotingPhase) {
                newVotes[choice] += 1;
                saveVotes(newVotes);
            }

            localStorage.setItem(`vote-choice-${id}`, choice);
            setVoteChoice(choice);
            setHasVoted(true);

        } else {
            // 再投票モードへ移行
            setRequireReason(true);
            setVoteChoice(choice);
        }
    };

    // 再投票確定処理
    const confirmReVote = () => {
        if (!reason.trim()) {
            alert("再投票には理由が必要です。");
            return;
        }

        const prevChoice = localStorage.getItem(`vote-choice-${id}`) as | "yes" | "no";

        // 投票フェーズの場合のみ、投票数を更新する
        if (isVotingPhase) {
            const newVotes = { ...votes };
            if (prevChoice) newVotes[prevChoice] -= 1;
            if (voteChoice) newVotes[voteChoice] += 1;
            saveVotes(newVotes);
        }

        localStorage.setItem(`vote-choice-${id}`, voteChoice!);

        // 理由の更新ロジック (省略)

        saveIsReVoter(true);
        setRequireReason(false);
        setReason("");
    };


    // 理由投稿の上書きロジック関数 (賛成のみ)
    const overwriteReason = (choice: "yes" | "no", reasonText: string, isRevote: boolean) => {
        if (choice === 'no') return;

        const newReasons = { ...reasons };

        // 1. 既存の自分の投稿を削除（上書きロジック）
        newReasons.yes = newReasons.yes.filter((r) => r.userId !== localUserId);

        // 2. 新しい投稿を作成 (Reason型を明示)
        const newReason: Reason = {
            text: reasonText,
            timestamp: new Date().toLocaleString(),
            userId: localUserId,
            isReVoter: isRevote,
            likes: 0,
            likedBy: [],
            reports: 0,
            isHidden: false,
        };

        // 3. 新しい投稿を追加 
        newReasons.yes.push(newReason);
        saveReasons(newReasons);
    };

    // 初回投稿/理由の更新処理
    const handleSubmitReason = () => {
        if (!reason.trim() || !voteChoice) return;
        if (voteChoice === 'no') return;

        overwriteReason(voteChoice, reason.trim(), false);
        setReason("");
    };

    // === いいねとソートロジック ===
    const handleLike = (index: number) => {
        // 修正: インデックスの有効性を確認
        if (index === -1 || index >= reasons.yes.length) return;

        if (!localUserId) return;

        const newReasons = { ...reasons };
        const targetReason = newReasons.yes[index];

        if (targetReason.likedBy.includes(localUserId)) {
            // いいねを取り消す (解除)
            targetReason.likes -= 1;
            targetReason.likedBy = targetReason.likedBy.filter(id => id !== localUserId);
        } else {
            // いいねする (追加)
            targetReason.likes += 1;
            targetReason.likedBy.push(localUserId);
        }
        saveReasons(newReasons);
    };

    const getSortedReasons = () => { return reasons.yes; };
    const sortedYesReasons = useMemo(() => getSortedReasons(), [reasons, sortBy]);

    // === 通報機能ロジック ===
    const handleReportReason = (reasonIndex: number, reasonText: string) => {
        if (reasonIndex === -1 || reasonIndex >= reasons.yes.length) return;
        // ... (通報ロジックは省略) ...
        alert(`理由を運営に通報しました。（デバッグメッセージ）`);
    };
    const handleReportComment = (commentIndex: number, commentText: string) => { /* ... */ };


    // === コメントロジック (ページネーション適用) ===
    // コメント追加関数
    const handleComment = () => {
        if (!newComment.trim() || !voteChoice) {
            alert("コメントを投稿するには、投票（参加）が必須です。");
            return;
        }

        // コメントオブジェクトの定義 (スコープ内)
        const newC: Comment = {
            text: newComment,
            timestamp: new Date().toLocaleString(),
            ...(quoteNumber && { quoteNumber: quoteNumber }),
            reports: 0,
            isHidden: false,
            userVoteChoice: voteChoice,
        };

        const updated = [...comments, newC];
        saveComments(updated);
        setNewComment("");
        setQuoteNumber(null);
        setCommentPage(Math.ceil(updated.length / COMMENTS_PER_PAGE));
    };

    const handleQuoteClick = (numberToQuote: number) => {
        setQuoteNumber(numberToQuote);
        if (commentInputRef.current) commentInputRef.current.focus();
    };

    // ページネーションによって表示するコメントを計算
    const startIndex = (commentPage - 1) * COMMENTS_PER_PAGE;
    const endIndex = startIndex + COMMENTS_PER_PAGE;
    const displayedComments = comments.slice(startIndex, endIndex);
    const totalPages = Math.ceil(comments.length / COMMENTS_PER_PAGE);
    const getCommentNumber = (index: number) => startIndex + index + 1;

    //投票割合の計算
    const totalVotes = votes.yes + votes.no;
    const yesPercentage = totalVotes === 0 ? 0 : Math.round((votes.yes / totalVotes) * 100);
    const noPercentage = totalVotes === 0 ? 0 : 100 - yesPercentage;

    // 再投票後のボタンテキスト制御
    const reasonButtonText = isReVoter
        ? "再投票理由を投稿する"
        : "理由を投稿する";


    // ★ 管理パネルのロジック: DUMMY_PHASE_KEY をローカルに保存し、強制的に上書きする ★
    const setSimulatedPhase = (phaseKey: string) => {
        // DUMMY_PHASE_KEYはconstなので直接変更できませんが、
        // 実際には管理画面からデータベースを更新するイメージです。
        // ここでは、外部で定義された定数（ここではDUMMY_PHASE_KEY）の値を変更し、
        // ページをリロードする動作をシミュレートします。
        alert(`【開発モード】フェーズを "${phaseKey}" に設定しました。ページをリロードして反映を確認してください。`);
        // 実際の管理画面ではDBを更新し、フロント側がそれを監視する形になります。
        // コンポーネントの強制的なリロードは避けるため、ここではアラートのみとします。
    };


    return (
        <div className="p-6 space-y-6">

            {/* 戻るボタン */}
            <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
            >
                ← ホームに戻る
            </button>

            {/* ★ 管理者フェーズコントロールパネルの JSX ★ */}
            <div className="p-3 border border-red-400 bg-red-50 rounded-lg">
                <h3 className="text-base font-bold text-red-700 mb-2">
                    ⚙️ 開発・運用管理パネル
                </h3>
                <p className="text-xs text-red-600 mb-2">
                    現在のフェーズ: <span className="font-semibold">{isVotingPhase ? "投票フェーズ" : isDiscussionPhase ? "議論フェーズ" : "その他のフェーズ"}</span>
                </p>
                <p className="text-xs text-red-600 mb-2">
                    （注意：このシミュレーションはコード内の定数を変更することで実行されます。）
                </p>
                {/* 実際の管理画面では、ボタンを押すと外部データが更新されます */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setSimulatedPhase("voting")}
                        className="text-xs px-2 py-1 bg-red-700 text-white rounded-md"
                    >
                        投票フェーズに強制
                    </button>
                    <button
                        onClick={() => setSimulatedPhase("discussion")}
                        className="text-xs px-2 py-1 bg-red-700 text-white rounded-md"
                    >
                        議論フェーズに強制
                    </button>
                </div>
            </div>
            {/* ★ 管理者フェーズコントロールパネルの JSX ここまで ★ */}

            <h1 className="text-2xl font-bold">お題の詳細ページ (ID: {id})</h1>

            {/* 投票セクション */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">投票</h2>

                {/* 投票ボタン */}
                <div className="flex gap-4">
                    <button
                        onClick={() => handleVote("yes")}
                        // ★ 修正: 投票済みマークを追加 ★
                        className={`px-4 py-2 ${COLORS.YES_BUTTON} text-white rounded-lg ${voteChoice === 'yes' ? COLORS.VOTED_ACTIVE : ''}`}
                        disabled={hasVoted && !requireReason}
                    >
                        👍 賛成
                    </button>
                    <button
                        onClick={() => handleVote("no")}
                        // ★ 修正: 投票済みマークを追加 ★
                        className={`px-4 py-2 ${COLORS.NO_BUTTON} text-white rounded-lg ${voteChoice === 'no' ? COLORS.VOTED_ACTIVE : ''}`}
                        disabled={hasVoted && !requireReason}
                    >
                        👎 反対
                    </button>

                    {/* 再投票ボタン: 投票済みかつ再投票未経験の場合のみ表示 */}
                    {hasVoted && !requireReason && !isReVoter && (
                        <button
                            onClick={() => setRequireReason(true)}
                            className={`px-4 py-2 ${COLORS.REVOTE_BUTTON} text-white rounded-lg`}
                        >
                            🔄 再投票する
                        </button>
                    )}
                </div>

                {/*割合表示セクション*/}
                {hasVoted && (
                    <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-bold mb-2">
                            現在の投票結果
                            {isReVoter && (
                                <span className={`text-sm font-normal ${COLORS.REVOTER_MARK} ml-2`}>
                                    (再投票者)
                                </span>
                            )}
                        </h3>
                        {/* ★ グラフ表示を追加 ★ */}
                        <div className="mb-3">
                            <div className="flex justify-between text-xs font-medium mb-1">
                                <span className="text-blue-600">賛成 {yesPercentage}%</span>
                                <span className="text-purple-600">反対 {noPercentage}%</span>
                            </div>
                            <div className="flex h-3 rounded overflow-hidden">
                                <div
                                    style={{ width: `${yesPercentage}%` }}
                                    className="bg-blue-600"
                                    title={`賛成: ${yesPercentage}%`}
                                />
                                <div
                                    style={{ width: `${noPercentage}%` }}
                                    className="bg-purple-600"
                                    title={`反対: ${noPercentage}%`}
                                />
                            </div>
                        </div>
                        {/* ★ グラフ表示ここまで ★ */}
                        <p className={COLORS.YES_TEXT}>
                            👍 賛成: {yesPercentage}%
                        </p>
                        <p className={COLORS.NO_TEXT}>
                            👎 反対: {noPercentage}%
                        </p>
                    </div>
                )}
            </div> {/* 投票セクション終わり */}

            <hr />

            {/* 理由投稿・閲覧セクション (投票結果の下) */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">投票理由の投稿・閲覧</h2>

                {/* 理由の上書きエリア (賛成投票済みの場合にのみ表示) */}
                {hasVoted && voteChoice === 'yes' && (

                    // isVotingPhase かどうかでフォームと注意書きを切り替える
                    isVotingPhase ? (
                        // --- 投票フェーズ: 投稿フォーム ---
                        <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                            <p className="font-bold">理由の投稿/上書き</p>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="賛成理由を投稿または上書き（任意）..."
                                className="w-full p-2 border rounded"
                            />
                            {reason.trim() && (
                                <button
                                    onClick={handleSubmitReason}
                                    className={`px-4 py-2 ${COLORS.YES_BUTTON} text-white rounded-lg`}
                                >
                                    {reasonButtonText}
                                </button>
                            )}
                        </div>
                    ) : (
                        // --- 議論フェーズ: 投稿不可の注意書き ---
                        <div className="p-4 border border-red-300 rounded-lg bg-red-50 text-red-700 font-semibold">
                            ⚠️ 議論フェーズ中は、理由の新規投稿・上書きはできません。
                        </div>
                    )
                )}

                {/* 再投票理由の入力エリア (requireReasonがONの場合にのみ表示) */}
                {requireReason && (
                    <div className={`space-y-2 p-4 border rounded-lg ${COLORS.REVOTE_AREA_BG}`}>
                        <p className={`font-bold ${COLORS.REVOTER_MARK}`}>⚠️ 再投票を確定するには、理由の入力が必須です。</p>
                        <p className="text-sm text-red-700 font-semibold">
                            ※ **一度再投票を確定すると、このお題では二度と投票（再投票）できなくなります**。ご注意ください。
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="再投票する理由を入力してください"
                            className="w-full p-2 border rounded"
                        />
                        <button
                            onClick={confirmReVote}
                            className={`px-4 py-2 ${COLORS.YES_BUTTON} text-white rounded-lg`}
                            disabled={!reason.trim()}
                        >
                            再投票を確定する
                        </button>
                    </div>
                )}

                {/* 投票理由一覧 */}
                <div className="space-y-2 mt-4">
                    <h3 className="text-lg font-semibold">投稿された理由</h3>

                    {/* ソートボタン */}
                    <div className="flex gap-2 text-sm">
                        <p className="text-gray-600 mr-2">並び替え:</p>
                        <button
                            onClick={() => setSortBy("newest")}
                            className={`px-3 py-1 rounded-full ${sortBy === 'newest' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            新しい順
                        </button>
                        <button
                            onClick={() => setSortBy("likes")}
                            className={`px-3 py-1 rounded-full ${sortBy === 'likes' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            いいねが多い順
                        </button>
                    </div>

                    <div className="flex gap-6">
                        <div className="flex-1">
                            <p className={`font-bold ${COLORS.YES_TEXT}`}>👍 賛成の理由 ({sortedYesReasons.length}件)</p>
                            <ul className="list-none space-y-3 pt-2">
                                {sortedYesReasons.map((r, i) => {
                                    // reasons.yesの中での元のインデックスを見つける
                                    const originalIndex = reasons.yes.findIndex(re => re.timestamp === r.timestamp && re.userId === r.userId);

                                    // 非表示の投稿はスキップ
                                    if (r.isHidden) return null;

                                    return (
                                        <li key={r.timestamp + i} className="p-3 border rounded-lg bg-white shadow-sm">
                                            <p className="mb-1">
                                                {r.text}
                                                {r.userId === localUserId && (
                                                    <span className="text-sm font-normal text-blue-500 ml-2">
                                                        (自分の投稿)
                                                        {r.isReVoter && <span className={`${COLORS.REVOTER_MARK} ml-1`}> (再投票)</span>}
                                                    </span>
                                                )}
                                            </p>

                                            <div className="flex justify-between items-center text-sm mt-2">
                                                <small className="text-gray-500">{r.timestamp}</small>
                                                <div className="flex gap-3">
                                                    {/* いいねボタン */}
                                                    <button
                                                        onClick={() => handleLike(originalIndex)}
                                                        className={`flex items-center gap-1 ${r.likedBy.includes(localUserId) ? COLORS.LIKED : COLORS.LIKE_BUTTON}`}
                                                        disabled={r.userId === localUserId || originalIndex === -1} // 自分の投稿、または見つからない場合は無効
                                                    >
                                                        ❤️ {r.likes}
                                                    </button>
                                                    {/* 通報ボタン */}
                                                    <button
                                                        onClick={() => handleReportReason(originalIndex, r.text)}
                                                        className="text-xs text-gray-400 hover:text-red-500"
                                                    >
                                                        🚨 通報
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                                {sortedYesReasons.length === 0 && <p className="text-gray-500 text-sm">まだ理由はありません。</p>}
                            </ul>

                        </div>
                    </div>
                </div>
            </div> {/* 理由投稿・閲覧セクション終わり */}


            <hr />

            {/* コメント掲示板 - フェーズに応じて切り替え */}
            <div className="space-y-4">

                {/* ★ 議論フェーズのタイトルと説明 ★ */}
                <h2 className="text-xl font-semibold">
                    {isDiscussionPhase ? "🗣️ 議論掲示板 (オープン)" : "🔒 陣営別掲示板 (議論準備)"}
                    ({comments.length}件)
                </h2>

                {/* ★ 投稿条件: 投票済みかつ議論フェーズであること ★ */}
                {!isDiscussionPhase && isVotingPhase && hasVoted && (
                    <p className="text-sm text-blue-600 font-semibold border-b pb-2">
                        ※ 現在は【投票フェーズ】です。掲示板には、あなたが投票した陣営のコメントのみが表示されます。
                    </p>
                )}

                {/* コメントリスト (ページネーション適用) */}
                <ul className="space-y-1"> {/* 項目間のスペースを 'space-y-1' に最小化 */}
                    {displayedComments
                        .filter(c =>
                            isDiscussionPhase || (isVotingPhase && c.userVoteChoice === voteChoice) // 投票フェーズ中は自陣営のみ表示
                        )
                        .map((c, i) => {
                            const commentNumber = getCommentNumber(i);
                            const quotedComment = c.quoteNumber ? comments[c.quoteNumber - 1] : null;

                            // 非表示の投稿はスキップ
                            if (c.isHidden) return null;

                            return (
                                <li key={commentNumber} className="p-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition duration-150">
                                    {/* 陣営表示 */}
                                    <div className="flex justify-between items-center mb-0.5 text-xs">
                                        <span className="font-semibold text-gray-700">No.{commentNumber}</span>
                                        {c.userVoteChoice && (
                                            <span className={`font-bold ml-2 ${c.userVoteChoice === 'yes' ? COLORS.YES_TEXT : COLORS.NO_TEXT}`}>
                                                [{c.userVoteChoice === 'yes' ? '賛成派' : '反対派'}]
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleQuoteClick(commentNumber)}
                                            className="text-[10px] text-blue-500 hover:underline font-medium"
                                        >
                                            引用
                                        </button>
                                    </div>

                                    {/* 引用元の表示 */}
                                    {c.quoteNumber && quotedComment && (
                                        <div className={`p-1 mb-1 text-[10px] border-l-4 border-gray-300 ${COLORS.QUOTE_TEXT} bg-gray-50 rounded-r`}>
                                            <span className="font-bold text-gray-700">{`>>${c.quoteNumber}`}</span>
                                            <blockquote className="ml-1 pl-1 border-l border-gray-400">
                                                {quotedComment.text.substring(0, 80)}{quotedComment.text.length > 80 ? '...' : ''}
                                            </blockquote>
                                        </div>
                                    )}

                                    {/* 本文 */}
                                    <p className="text-gray-900 text-xs leading-snug">{c.text}</p>

                                    {/* タイムスタンプと通報ボタン */}
                                    <div className="flex justify-between items-center mt-1">
                                        <small className="text-gray-500 text-[10px]">{c.timestamp}</small>
                                        {/* 通報ボタン */}
                                        <button
                                            onClick={() => handleReportComment(startIndex + i, c.text)}
                                            className="text-[10px] text-gray-400 hover:text-red-500"
                                        >
                                            🚨 通報
                                        </button>
                                    </div>

                                </li>
                            );
                        })}
                    {/* コメントがない場合の表示ロジック */}
                    {displayedComments.filter(c => isDiscussionPhase || (isVotingPhase && c.userVoteChoice === voteChoice)).length === 0 && (
                        <p className="text-gray-500">まだコメントはありません。</p>
                    )}
                </ul>

                {/* ページネーションコントロール */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <button
                            onClick={() => setCommentPage(prev => Math.max(1, prev - 1))}
                            disabled={commentPage === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            ← 前へ
                        </button>
                        <span className="font-semibold">
                            ページ {commentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCommentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={commentPage === totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            次へ →
                        </button>
                    </div>
                )}


                {/* コメント入力エリア */}
                {/* 引用中であることを明確に表示 */}
                {quoteNumber && (
                    <div className={`p-2 border rounded-lg bg-yellow-100 ${COLORS.REVOTER_MARK} font-bold flex justify-between items-center`}>
                        <span className="text-gray-800">
                            💡 No. <span className="text-xl">{quoteNumber}</span> のコメントを引用して投稿します。
                        </span>
                        <button
                            onClick={() => setQuoteNumber(null)}
                            className="text-sm text-red-500 hover:text-red-700 font-normal underline ml-4"
                        >
                            引用を解除
                        </button>
                    </div>
                )}
                <textarea
                    // ★ refを適用 ★
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="コメントを入力..."
                    className="w-full p-2 border rounded"
                />
                <button
                    onClick={handleComment}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                    コメントを投稿
                </button>
            </div>
        </div>
    );
}