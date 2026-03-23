// Local Post type definitions
export interface PostImage {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
}

export interface PostAuthor {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

export interface PostHistoryEntry {
  id: string;
  content: string;
  content_warning: string | null;
  edited_at: string;
  edited_by: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  };
  images: PostImage[];
}

export interface Post {
  id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  announcement?: boolean;
  content_warning?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  pinned_at?: string | null;
  author: PostAuthor;
  images: PostImage[];
  in_reply_to_id?: string | null;
  depth?: number;
  root_post_id?: string | null;
  is_bookmarked?: boolean;
  replies?: Post[];
  reply_count?: number;
  has_more_replies?: boolean;
  reactions?: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
}

// Component props interfaces
export interface PostCardProps {
  post: Post;
  currentProfileId?: string;
  onDelete?: () => void;
  onRefresh?: () => void;
  isCommunityOwner?: boolean;
  isModerator?: boolean;
  hideBorder?: boolean;
  isProfileView?: boolean;
  displayDepth?: number;
  isContinuation?: boolean;
}

export interface PostListRef {
  refresh: () => void;
}
