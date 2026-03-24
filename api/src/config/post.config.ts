/**
 * Post and threading configuration
 */

export const POST_CONFIG = {
  /**
   * Maximum depth for threaded replies
   * Prevents infinite recursion and keeps thread readability
   */
  MAX_REPLY_DEPTH: 10,

  /**
   * Number of replies to fetch when building thread
   */
  THREAD_REPLY_LIMIT: 100,

  /**
   * Default pagination limits for different content types
   */
  PAGINATION: {
    /**
     * Default limit for post listings
     */
    POSTS_DEFAULT_LIMIT: 20,

    /**
     * Default limit for announcement listings
     */
    ANNOUNCEMENTS_DEFAULT_LIMIT: 10,

    /**
     * Default limit for conversation/message listings
     */
    CONVERSATIONS_DEFAULT_LIMIT: 20,

    /**
     * Default limit for profile listings
     */
    PROFILES_DEFAULT_LIMIT: 20,

    /**
     * Messages to fetch in conversation thread
     */
    MESSAGES_LIMIT: 100,

    /**
     * Maximum allowed limit for any pagination
     */
    MAX_LIMIT: 100,
  },

  /**
   * Image upload constraints
   */
  IMAGE: {
    /**
     * Maximum file size in bytes (10MB)
     */
    MAX_FILE_SIZE: 10 * 1024 * 1024,

    /**
     * Allowed image MIME types
     */
    ALLOWED_MIME_TYPES: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
    ],

    /**
     * Allowed file extensions (lowercase, without dot)
     */
    ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"],
  },
} as const;
