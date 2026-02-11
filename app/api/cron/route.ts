// app/api/cron/route.ts
import { NextResponse } from 'next/server';
import { db, auth } from '@/app/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
    collection, doc, getDocs, writeBatch, getDoc
} from 'firebase/firestore';

// キャッシュされないように動的設定にする
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. セキュリティチェック
    // VercelのCron機能以外から勝手にURLを叩かれるのを防ぎます
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("🤖 Cron Job Started: Trying to login...");

        // 2. Botとしてログイン
        if (!process.env.CRON_BOT_EMAIL || !process.env.CRON_BOT_PASSWORD) {
            throw new Error("❌ 環境変数が設定されていません (CRON_BOT_EMAIL / PASSWORD)");
        }

        await signInWithEmailAndPassword(
            auth,
            process.env.CRON_BOT_EMAIL,
            process.env.CRON_BOT_PASSWORD
        );
        console.log("✅ Login Successful");

        const batch = writeBatch(db);
        const now = new Date();

        // IDに時間を含める（秒単位まで）
        // これにより、テスト等で短時間に連続実行しても別々のアーカイブとして保存されます
        const dateStr = now.toISOString().replace(/[-T:]/g, '').split('.')[0];
        const dateLabel = now.toLocaleDateString('ja-JP');

        // 3. お題の取得
        const topicsRef = collection(db, "topics");
        const topicsSnap = await getDocs(topicsRef);

        let processedCount = 0;
        console.log(`📂 Checking ${topicsSnap.size} topics...`);

        for (const topicDoc of topicsSnap.docs) {
            const topic = topicDoc.data();

            // チェック1: 既にアーカイブ済みのものは無視
            if (topic.type === 'archive' || topic.status === 'archived') continue;

            // チェック2: 未来のお題（予告）は無視！
            const startDate = topic.startDate ? new Date(topic.startDate) : new Date(0);
            if (topic.status === 'upcoming' || startDate > now) {
                console.log(`   -> ⏭️ SKIPPED (Future topic: ${topic.title})`);
                continue;
            }

            console.log(`   -> 🎯 TARGET: Archiving "${topic.title}"`);

            // --- アーカイブ処理 ---
            const id = topic.topicId || topicDoc.id;

            if (!id) {
                console.log("❌ Error: IDが見つからないためスキップしました");
                continue;
            }
            const archiveId = `${id}_${dateStr}`;

            // 3-1. アーカイブデータの作成
            const archiveRef = doc(db, "topics", archiveId);
            const newArchiveData = {
                ...topic,
                id: archiveId,
                topicId: archiveId,
                type: 'archive',
                status: 'archived',
                originalEndpointId: id,
                title: `${topic.title} (${dateLabel}の回)`,
                archiveType: topic.type === 'official' ? 'official' : 'weekly',
                votes: topic.votes || {},
                startDate: topic.startDate || now.toISOString(),
                endDate: now.toISOString()
            };

            // undefined 対策 (JSON変換でゴミを削除)
            const cleanData = JSON.parse(JSON.stringify(newArchiveData));
            batch.set(archiveRef, cleanData);

            // 3-2. 投票詳細データのコピー
            const voteMapRef = doc(db, "topic_votes", id);
            const voteMapSnap = await getDoc(voteMapRef);
            if (voteMapSnap.exists()) {
                const voteMapData = voteMapSnap.data();
                const archiveVoteMapRef = doc(db, "topic_votes", archiveId);
                batch.set(archiveVoteMapRef, voteMapData);

                // 常設の場合はリセットのために元の投票データを削除
                if (topic.type === 'official') {
                    batch.delete(voteMapRef);
                }
            }

            // 3-3. コメントと理由の移動
            const commentsRef = collection(db, "topics", id, "comments");
            const commentsSnap = await getDocs(commentsRef);
            commentsSnap.forEach((c) => {
                batch.set(doc(db, "topics", archiveId, "comments", c.id), c.data());
                batch.delete(doc(db, "topics", id, "comments", c.id));
            });

            const reasonsRef = collection(db, "topics", id, "reasons");
            const reasonsSnap = await getDocs(reasonsRef);
            reasonsSnap.forEach((r) => {
                batch.set(doc(db, "topics", archiveId, "reasons", r.id), r.data());
                batch.delete(doc(db, "topics", id, "reasons", r.id));
            });

            // 3-4. 本体の更新 (リセット または 終了)
            const originalRef = doc(db, "topics", id);
            if (topic.type === 'official') {
                // 常設: リセットして来週へ
                const nextEndDate = new Date();
                nextEndDate.setDate(nextEndDate.getDate() + 7);
                batch.update(originalRef, {
                    startDate: now.toISOString(),
                    endDate: nextEndDate.toISOString(),
                    votes: {},
                    votedUserIds: []
                });
                console.log(`     -> Official topic RESET completed.`);
            } else {
                // 週替わり: 単に終了ステータスへ
                batch.update(originalRef, {
                    status: 'archived',
                    type: 'archive'
                });
                console.log(`     -> Weekly topic CLOSED.`);
            }

            processedCount++;
        }

        // 4. まとめて実行
        if (processedCount > 0) {
            await batch.commit();
            console.log(`✨ SUCCESS: Archived ${processedCount} topics.`);
            return NextResponse.json({ success: true, processed: processedCount });
        } else {
            console.log(`⚠️ NO ACTION: No active topics found.`);
            return NextResponse.json({ success: true, message: "No topics to archive" });
        }

    } catch (error: any) {
        console.error('❌ Cron Error:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}