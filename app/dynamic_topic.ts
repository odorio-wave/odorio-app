export type Option = {
  id: string;
  prefix: string;
  text: string;
};

export type Reason = {
  id: string;
  likedUserIds?: string[];
  likeCount?: number;
  text: string;
  timestamp: string;
  userId: string;
  isReVoter: boolean;
  likes: number;
  likedBy: string[];
  reports: number;
  isHidden: boolean;
  voteOptionId: string;
};

export type Reasons = Record<string, Reason[]>;

export type Comment = {
  text: string;
  timestamp: string;
  quoteNumber?: number;
  reports: number;
  isHidden: boolean;
  userVoteChoice?: string | null;
  isReVoter?: boolean;
};

export type Topic = {
    id: string;
    topicId?: string; // FirestoreドキュメントIDとの整合性用
    title: string;
    description: string;
    type: string; // 'official' | 'weekly' | 'archive'
    startDate: string;
    endDate: string;
    status?: string; // 'published' | 'pending' | 'archived'
    options?: Option[]; 
    
    // ★ Firebase用追加項目 ★
    originalEndpointId?: string; // 常設お題の過去ログである場合、元のIDを保持
    archiveLikes?: string[];     // アーカイブへのいいね（ユーザーIDの配列）
};

// 初期表示用（Firestoreから取得できない場合のフォールバックとして空配列）
export const topics: Topic[] = [];

// 提案のデータ構造
export type ProposalOption = {
  prefix: string;
  text: string;
  id?: string;
};

export type Proposal = {
    id: string;
    title: string;
    description: string; 
    options: ProposalOption[]; 
    votes: number;
    createdAt: string;
    
    // ★ Firebase用追加項目 ★
    voterIds?: string[]; // 誰がいいねしたかを保持して重複防止
};

// --- トピックごとの投票結果型
export type TopicVoteResult = {
  yes: number;
  no: number;
  yesPercentage: number;
  noPercentage: number;
  totalVotes: number;
  // 選択肢ごとの詳細データを追加
  options?: {
    id: string;
    count: number;
    percentage: number;
  }[];
};

// ホーム画面で使用するダミーのトピックリスト
/* export type Topic = {
  id: string;
  title: string;
  description: string;
  type: 'official' | 'weekly' | 'archive' | string;
  startDate: string;
  endDate: string;
  status?: 'published' | 'pending' | 'archived' | string; // statusプロパティを追加
  topicId?: string; // Home.tsxで追加したプロパティ
  options?: { id: string; prefix: string; text: string; }[];
  originalEndpointId?: string;
}; */

/* export const topics: Topic[] = [
  {
    id: "static_01",
    title: "トロッコ問題の是非",
    description: "有名な倫理的ジレンマ。5人を救うため、1人を犠牲にすべきか？",
    type: "official",
    startDate: "2025-10-01T09:00:00.000Z",
    endDate: "2099-12-31T23:59:59.000Z",
  }
]; */

// 管理画面で作成されるべき動的なお題データの型
export type DynamicTopicData = {
  topicId: string;
  title: string;
  description: string;
  options: Option[];
  status: 'published' | 'pending' | 'archived' | string;
  createdAt: string;
  // Home.tsx の分類ロジックで必須のプロパティ
  startDate: string;
  endDate: string;
  type: 'official' | 'weekly' | 'archive' | string;
  originalEndpointId?: string;
};
