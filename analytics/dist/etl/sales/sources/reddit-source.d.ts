export interface RedditPost {
    title: string;
    url: string;
    externalUrl: string;
    subreddit: string;
    author: string;
    score: number;
    selftext: string;
    createdAt: string;
    keyword: string;
}
export declare function fetchRedditPosts(): Promise<RedditPost[]>;
