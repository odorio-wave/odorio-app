import HomeClient from "./components/HomeClient"; // ファイルを読み込む

// ▼ これで「常に最新データを取る」設定が有効になります
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <>
      {/* クライアント側の処理は全部こっちに任せる */}
      <HomeClient />
    </>
  );
}