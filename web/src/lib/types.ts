export type Role = "ADMIN" | "MEMBER";
export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  eligible: boolean;
}

export interface ManagedUser extends AuthUser {
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  eligible: boolean;
  role: Role;
}

export interface CoffeeMember {
  id: string;
  name: string;
}

export interface CoffeeDay {
  id: string;
  date: string; // yyyy-MM-dd
  roundNumber: number;
  status: "SCHEDULED" | "DONE" | "SKIPPED";
  isToday: boolean;
  passed: boolean;
  members: CoffeeMember[];
}

export interface RoundProgress {
  roundNumber: number;
  total: number;
  done: number;
}

export interface ReplyPreview {
  id: string;
  text: string | null;
  hasImage: boolean;
  authorName: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface CoffeeRating {
  userId: string;
  stars: number;
}

export interface ChatMessage {
  id: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
  isCoffeeProof?: boolean;
  isCoffeeRequest?: boolean;
  user: { id: string; name: string };
  replyTo?: ReplyPreview | null;
  reactions?: MessageReaction[];
  ratings?: CoffeeRating[];
}

export interface RankingEntry {
  userId: string;
  name: string;
  count: number;
}

export interface RatingRankEntry {
  userId: string;
  name: string;
  average: number;
  votes: number;
}

export interface MediaItem {
  id: string;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ReadState {
  userId: string;
  name: string;
  lastReadAt: string | null;
}
