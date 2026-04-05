import { MetadataRoute } from 'next';
// ★お使いのFirebase設定ファイルのパスに合わせて変更してください
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://odorio-app.vercel.app';

  // 1. 固定のページ（トップページなど）を定義
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0, // トップページは一番重要
    },
    // 必要であれば /guide や /terms などの固定ページもここに追加します
  ];

  try {
    // 2. Firebaseから「公開中」または「アーカイブ」のお題を全て取得
    // ※下書きや非公開のものをGoogleに教えないようにするため
    const q = query(
      collection(db, 'topics'),
      where('status', 'in', ['published', 'archived'])
    );
    const querySnapshot = await getDocs(q);

    // 3. 取得したお題の数だけ、URLを生成してリストに追加
    querySnapshot.forEach((doc) => {
      const topicData = doc.data();

      routes.push({
        url: `${baseUrl}/topic/${doc.id}`,
        // もしDBに更新日(updatedAt)があればそれを使うとさらにSEOに良いです
        lastModified: topicData.createdAt ? new Date(topicData.createdAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8, // 各お題ページの重要度
      });
    });

  } catch (error) {
    console.error("サイトマップ生成中のエラー:", error);
    // エラーが起きても、最低限トップページだけは返すようにする
  }

  // 4. 完成した全URLのリストをGoogleに提出！
  return routes;
}