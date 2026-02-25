import type { Topic } from "@/lib/domain/topic";

export interface AdminTopicsListResponse {
  items: Topic[];
}

export interface AdminTopicCreateRequest {
  name: string;
}

export interface AdminTopicUpdateRequest {
  name?: string;
  isActive?: boolean;
}

export interface AdminTopicResponse {
  topic: Topic;
}

