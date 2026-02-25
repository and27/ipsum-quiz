import type {
  ImageAllowedMimeType,
  ImageAsset,
  ImageAssetEntityType,
} from "@/lib/domain/image-asset";
import {
  IMAGE_ALLOWED_MIME_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_INPUT_DIMENSION,
  IMAGE_MAX_OUTPUT_DIMENSION,
} from "@/lib/domain/image-asset";
import { createClient } from "@/lib/supabase/server";

const ORIGINAL_BUCKET = "questions-original";
const PUBLIC_BUCKET = "questions-public";

const PROCESSED_MIME_TYPES = {
  webp: "image/webp",
  jpeg: "image/jpeg",
} as const;

type ProcessedVariant = keyof typeof PROCESSED_MIME_TYPES;

type ImageUploadErrorCode =
  | "invalid_entity_type"
  | "missing_file"
  | "invalid_mime_type"
  | "file_too_large"
  | "invalid_dimensions"
  | "invalid_processed_variant"
  | "upload_failed"
  | "persistence_failed";

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;

  constructor(code: ImageUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ImageUploadError";
  }
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface RawImageAssetRow {
  id: string;
  entity_type: ImageAssetEntityType;
  uploaded_by: string;
  original_path: string;
  original_mime_type: ImageAllowedMimeType;
  original_bytes: number;
  width: number;
  height: number;
  webp_path: string;
  webp_url: string;
  webp_bytes: number;
  jpeg_path: string;
  jpeg_url: string;
  jpeg_bytes: number;
  created_at: string;
}

interface UploadImageInput {
  entityType: ImageAssetEntityType;
  uploadedBy: string;
  originalFile: File;
  processedWebpFile: File;
  processedJpegFile: File;
}

function isImageAssetEntityType(value: unknown): value is ImageAssetEntityType {
  return value === "question" || value === "option";
}

function mimeToExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "bin";
}

function isAllowedInputMimeType(value: unknown): value is ImageAllowedMimeType {
  return (
    typeof value === "string" &&
    IMAGE_ALLOWED_MIME_TYPES.some((mimeType) => mimeType === value)
  );
}

function ensureDimensionLimits(
  dimensions: ImageDimensions,
  max: number,
  label: string,
): void {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > max ||
    dimensions.height > max
  ) {
    throw new ImageUploadError(
      "invalid_dimensions",
      `${label} dimensions must be between 1x1 and ${max}x${max}.`,
    );
  }
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) {
    return null;
  }
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + segmentLength + 2 > buffer.length) {
      return null;
    }

    const isSofMarker =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isSofMarker) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) {
    return null;
  }

  if (
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");

  if (chunkType === "VP8X") {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];

    return {
      width: 1 + (b1 | ((b2 & 0x3f) << 8)),
      height: 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    };
  }

  return null;
}

function parseImageDimensions(
  buffer: Buffer,
  mimeType: string,
): ImageDimensions | null {
  if (mimeType === "image/png") {
    return parsePngDimensions(buffer);
  }
  if (mimeType === "image/jpeg") {
    return parseJpegDimensions(buffer);
  }
  if (mimeType === "image/webp") {
    return parseWebpDimensions(buffer);
  }
  return null;
}

async function validateInputFile(file: File): Promise<{
  mimeType: ImageAllowedMimeType;
  buffer: Buffer;
  dimensions: ImageDimensions;
}> {
  if (!isAllowedInputMimeType(file.type)) {
    throw new ImageUploadError(
      "invalid_mime_type",
      "Only JPEG, PNG and WebP files are allowed.",
    );
  }

  if (file.size <= 0 || file.size > IMAGE_MAX_BYTES) {
    throw new ImageUploadError(
      "file_too_large",
      "Input image must be 8 MB or smaller.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = parseImageDimensions(buffer, file.type);
  if (!dimensions) {
    throw new ImageUploadError(
      "invalid_dimensions",
      "Could not read input image dimensions.",
    );
  }

  ensureDimensionLimits(dimensions, IMAGE_MAX_INPUT_DIMENSION, "Input image");

  return {
    mimeType: file.type,
    buffer,
    dimensions,
  };
}

async function validateProcessedFile(
  file: File,
  variant: ProcessedVariant,
): Promise<{ buffer: Buffer; dimensions: ImageDimensions }> {
  const expectedMimeType = PROCESSED_MIME_TYPES[variant];
  if (file.type !== expectedMimeType) {
    throw new ImageUploadError(
      "invalid_processed_variant",
      `Processed ${variant.toUpperCase()} file must use MIME ${expectedMimeType}.`,
    );
  }

  if (file.size <= 0 || file.size > IMAGE_MAX_BYTES) {
    throw new ImageUploadError(
      "file_too_large",
      `Processed ${variant.toUpperCase()} image must be 8 MB or smaller.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = parseImageDimensions(buffer, file.type);
  if (!dimensions) {
    throw new ImageUploadError(
      "invalid_dimensions",
      `Could not read processed ${variant.toUpperCase()} dimensions.`,
    );
  }

  ensureDimensionLimits(
    dimensions,
    IMAGE_MAX_OUTPUT_DIMENSION,
    `Processed ${variant.toUpperCase()}`,
  );

  return { buffer, dimensions };
}

function parseImageAssetRow(row: unknown): ImageAsset | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as RawImageAssetRow;
  if (
    typeof data.id !== "string" ||
    !isImageAssetEntityType(data.entity_type) ||
    typeof data.uploaded_by !== "string" ||
    typeof data.original_path !== "string" ||
    !isAllowedInputMimeType(data.original_mime_type) ||
    typeof data.original_bytes !== "number" ||
    typeof data.width !== "number" ||
    typeof data.height !== "number" ||
    typeof data.webp_path !== "string" ||
    typeof data.webp_url !== "string" ||
    typeof data.webp_bytes !== "number" ||
    typeof data.jpeg_path !== "string" ||
    typeof data.jpeg_url !== "string" ||
    typeof data.jpeg_bytes !== "number" ||
    typeof data.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: data.id,
    entityType: data.entity_type,
    uploadedBy: data.uploaded_by,
    originalPath: data.original_path,
    originalMimeType: data.original_mime_type,
    originalBytes: data.original_bytes,
    width: data.width,
    height: data.height,
    webpPath: data.webp_path,
    webpUrl: data.webp_url,
    webpBytes: data.webp_bytes,
    jpegPath: data.jpeg_path,
    jpegUrl: data.jpeg_url,
    jpegBytes: data.jpeg_bytes,
    finalUrl: data.webp_url,
    createdAt: data.created_at,
  };
}

export async function uploadProcessedImageAsset(
  input: UploadImageInput,
): Promise<ImageAsset> {
  if (!isImageAssetEntityType(input.entityType)) {
    throw new ImageUploadError("invalid_entity_type", "Invalid entity type.");
  }

  if (
    !(input.originalFile instanceof File) ||
    !(input.processedWebpFile instanceof File) ||
    !(input.processedJpegFile instanceof File)
  ) {
    throw new ImageUploadError("missing_file", "All image files are required.");
  }

  const original = await validateInputFile(input.originalFile);
  const processedWebp = await validateProcessedFile(input.processedWebpFile, "webp");
  const processedJpeg = await validateProcessedFile(input.processedJpegFile, "jpeg");

  if (
    processedWebp.dimensions.width !== processedJpeg.dimensions.width ||
    processedWebp.dimensions.height !== processedJpeg.dimensions.height
  ) {
    throw new ImageUploadError(
      "invalid_processed_variant",
      "Processed WebP and JPEG dimensions must match.",
    );
  }

  const now = new Date();
  const datePrefix = `${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
  const assetId = crypto.randomUUID();

  const originalPath = `${input.entityType}/${input.uploadedBy}/${datePrefix}/${assetId}.${mimeToExtension(original.mimeType)}`;
  const webpPath = `${input.entityType}/${input.uploadedBy}/${datePrefix}/${assetId}.webp`;
  const jpegPath = `${input.entityType}/${input.uploadedBy}/${datePrefix}/${assetId}.jpg`;

  const supabase = await createClient();

  const originalUpload = await supabase.storage
    .from(ORIGINAL_BUCKET)
    .upload(originalPath, original.buffer, {
      contentType: original.mimeType,
      upsert: false,
    });
  if (originalUpload.error) {
    throw new ImageUploadError(
      "upload_failed",
      `Failed to upload original image: ${originalUpload.error.message}`,
    );
  }

  const webpUpload = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(webpPath, processedWebp.buffer, {
      contentType: PROCESSED_MIME_TYPES.webp,
      upsert: false,
    });
  if (webpUpload.error) {
    throw new ImageUploadError(
      "upload_failed",
      `Failed to upload WebP image: ${webpUpload.error.message}`,
    );
  }

  const jpegUpload = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(jpegPath, processedJpeg.buffer, {
      contentType: PROCESSED_MIME_TYPES.jpeg,
      upsert: false,
    });
  if (jpegUpload.error) {
    throw new ImageUploadError(
      "upload_failed",
      `Failed to upload JPEG image: ${jpegUpload.error.message}`,
    );
  }

  const webpPublicUrl = supabase.storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(webpPath).data.publicUrl;
  const jpegPublicUrl = supabase.storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(jpegPath).data.publicUrl;

  const { data, error } = await supabase
    .from("image_assets")
    .insert({
      entity_type: input.entityType,
      uploaded_by: input.uploadedBy,
      original_bucket: ORIGINAL_BUCKET,
      original_path: originalPath,
      original_mime_type: original.mimeType,
      original_bytes: original.buffer.byteLength,
      width: processedWebp.dimensions.width,
      height: processedWebp.dimensions.height,
      webp_bucket: PUBLIC_BUCKET,
      webp_path: webpPath,
      webp_url: webpPublicUrl,
      webp_bytes: processedWebp.buffer.byteLength,
      jpeg_bucket: PUBLIC_BUCKET,
      jpeg_path: jpegPath,
      jpeg_url: jpegPublicUrl,
      jpeg_bytes: processedJpeg.buffer.byteLength,
    })
    .select(
      "id, entity_type, uploaded_by, original_path, original_mime_type, original_bytes, width, height, webp_path, webp_url, webp_bytes, jpeg_path, jpeg_url, jpeg_bytes, created_at",
    )
    .single();

  if (error) {
    throw new ImageUploadError(
      "persistence_failed",
      `Failed to store image metadata: ${error.message}`,
    );
  }

  const asset = parseImageAssetRow(data);
  if (!asset) {
    throw new ImageUploadError(
      "persistence_failed",
      "Invalid metadata payload returned from database.",
    );
  }

  return asset;
}

