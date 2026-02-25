import type { ISODateTimeString, UUID } from "./common";

export const IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ImageAllowedMimeType = (typeof IMAGE_ALLOWED_MIME_TYPES)[number];

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_MAX_INPUT_DIMENSION = 4000;
export const IMAGE_MAX_OUTPUT_DIMENSION = 1600;

export type ImageAssetEntityType = "question" | "option";

export interface ImageAsset {
  id: UUID;
  entityType: ImageAssetEntityType;
  uploadedBy: UUID;
  originalPath: string;
  originalMimeType: ImageAllowedMimeType;
  originalBytes: number;
  width: number;
  height: number;
  webpPath: string;
  webpUrl: string;
  webpBytes: number;
  jpegPath: string;
  jpegUrl: string;
  jpegBytes: number;
  finalUrl: string;
  createdAt: ISODateTimeString;
}

