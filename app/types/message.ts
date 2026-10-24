/**
 * Message and conversation types
 */

export interface Conversation {
  other_profile?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string | null;
  };
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    is_sender: boolean;
  };
  unread_count: string;
}

export interface GroupChat {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender: {
      id: string;
      name: string;
      username: string;
    };
  } | null;
  unread_count: number;
}

export interface DirectMessage {
  id: string;
  content: string;
  created_at: string;
  is_sender: boolean;
  sender_profile?: {
    id: string;
    name: string;
    username: string;
    profile_picture_url?: string | null;
  };
}

export interface GroupChatMessage {
  id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture_url?: string | null;
  };
}
