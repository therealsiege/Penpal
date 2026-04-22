export interface HNPost {
    title: string;
    url: string;
    author: string;
    points: number;
    createdAt: string;
    keyword: string;
    type: "job" | "story";
}
export declare function fetchHNPosts(): Promise<HNPost[]>;
