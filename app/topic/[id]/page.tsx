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
    try {
        const docRef = doc(db, "topics", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            topic = snap.data();
        }
    } catch (e) {
        console.error("Metadata fetch error", e);
    }

    if (!topic) {
        return { title: 'お題が見つかりません - ODORIO' };
    }

    const optionsText = topic.options?.map((o: any) => o.text).join(" vs ");
    const pageTitle = `${topic.title} (${optionsText})`;

    return {
        title: pageTitle,
        description: `${topic.title}について投票受付中！`,
        openGraph: {
            title: pageTitle,
            description: `${topic.title}について投票受付中！`,
            url: `https://odorio-app.vercel.app/topic/${id}`,
        },
        twitter: {
            card: 'summary_large_image',
            title: pageTitle,
            description: `${topic.title}について投票受付中！`,
        }
    }
}

// 2. メインのページコンポーネント
// ここはサーバーコンポーネントとして動作し、
// クライアントコンポーネント(TopicClient)を呼び出す役割だけをします
export default async function TopicPage({ params }: Props) {
    // params を await して、確実に id (文字列) を取り出してから渡します
    const { id } = await params;

    return (
        <TopicClient id={id} />
    );
}