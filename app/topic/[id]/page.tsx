import { db } from "@/app/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Metadata, ResolvingMetadata } from 'next';
import TopicClient from "./TopicClient";

type Props = {
    params: Promise<{ id: string }>
}

// 1. ここに generateMetadata を置く（サーバー側で動く）
export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;

    // SEO用データの取得
    let topic = null;
    let topicData: any = {}; // 型エラー防止のため初期化

    try {
        const docRef = doc(db, "topics", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            topicData = snap.data();
            topic = topicData;
        }
    } catch (e) {
        console.error("Metadata fetch error", e);
    }

    if (!topic) {
        return { title: 'お題が見つかりません - ODORIO' };
    }

    // タイトル生成: "きのこ vs たけのこ (きのこ vs たけのこ) | ODORIO"
    const optionsText = topicData.options?.map((o: any) => o.text).join(" vs ");
    const pageTitle = `${topicData.title} | ODORIO`;

    // 固定の短いキャッチコピーにする
    const shortDescription = "究極の2択！あなたはどっち派？みんなの投票結果を見てみよう。";

    return {
        title: pageTitle,
        description: shortDescription,
        openGraph: {
            title: pageTitle,
            description: shortDescription, // ← LINEのカードにはここが出ます
            url: `https://odorio-app.vercel.app/topic/${id}`,
            siteName: 'ODORIO',
            locale: 'ja_JP',
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: pageTitle,
            description: shortDescription, // ← Xのカードにはここが出ます
        }
    }
}

// 2. メインのページコンポーネント
export default async function TopicPage({ params }: Props) {
    const { id } = await params;

    return (
        <TopicClient id={id} />
    );
}