// topics.ts
export type Topic = {
  id: string;
  title: string;
  description?: string;
  type: "weekly" | "official";
  startDate: string; // ISO
  endDate: string;   // ISO
};

// サンプルデータ（開発者が編集して運用）
export const topics: Topic[] = [
  {
    id: "official-1",
    title: "トロッコ問題（古典）",
    description: "有名な倫理のジレンマ。条件を変えるとどうしますか？",
    type: "official",
    startDate: "2025-01-01T00:00:00+09:00",
    endDate: "2099-12-31T23:59:59+09:00",
  },
  {
    id: "weekly-1",
    title: "AIは人間の仕事を奪うか？",
    description: "技術の進化と雇用について考えましょう。",
    type: "weekly",
    startDate: "2025-09-15T09:00:00+09:00",
    endDate: "2025-09-21T23:59:59+09:00",
  },
  {
    id: "weekly-2",
    title: "紙の本 vs 電子書籍、どちらが良い？",
    description: "読書スタイルの未来を議論しましょう。",
    type: "weekly",
    startDate: "2025-09-22T09:00:00+09:00",
    endDate: "2025-09-28T23:59:59+09:00",
  },
  {
    id: "weekly-3",
    title: "SNSの拡散は社会にプラスか？",
    description: "情報流通の功罪について話し合おう。",
    type: "weekly",
    startDate: "2025-09-29T09:00:00+09:00",
    endDate: "2025-10-05T23:59:59+09:00",
  },
];
