export type User = { id: string; name: string; email: string };
export type Post = { id: string; title: string; content: string };

export const users = new Map<string, User>();
export const posts = new Map<string, Post>();
