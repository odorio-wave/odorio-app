import { Topic, TopicVoteResult } from './dynamic_topic';

// ★ Home.tsx が投票結果を計算するために使用するヘルパー関数 ★
export function getTopicVotes(topics: Topic[]): Record<string, TopicVoteResult> {
    const results: Record<string, TopicVoteResult> = {};
    
    // クライアントサイドでのみ実行
    if (typeof window === 'undefined') return results;

    topics.forEach(t => {
        // TopicDetail.tsx が使用するキー形式を流用
        const rawVotes = localStorage.getItem(`votes-${t.id}`);
        if (rawVotes) {
            try {
                const votes = JSON.parse(rawVotes);
                // votesは { yes: 10, no: 5 } のような従来の形式を想定
                const total = votes.yes + votes.no; 
                const yesPct = total === 0 ? 0 : Math.round((votes.yes / total) * 100);
                const noPct = total === 0 ? 0 : 100 - yesPct;
                results[t.id] = { yes: votes.yes, no: votes.no, yesPercentage: yesPct, noPercentage: noPct, totalVotes: total };
            } catch {
            }
        }
    });
    
    return results;
}

// LocalStorageキーのヘルパー関数 (TopicDetailでも使用)
export const getReasonStorageKey = (id: string): string => `dynamic_reasons_${id}`;
export const getVoteStorageKey = (id: string): string => `dynamic_votes_${id}`;
export const getCommentStorageKey = (id: string): string => `dynamic_comments_${id}`;
