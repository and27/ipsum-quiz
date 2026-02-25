import {
  IMAGE_ALLOWED_MIME_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_INPUT_DIMENSION,
  IMAGE_MAX_OUTPUT_DIMENSION,
  type ImageAllowedMimeType,
} from "@/lib/domain/image-asset";

export class ClientImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientImageProcessingError";
  }
}

export interface PreparedImageUpload {
  originalFile: File;
  processedWebpFile: File;
  processedJpegFile: File;
  outputWidth: number;
  outputHeight: number;
}

function isAllowedInputMimeType(value: unknown): value is ImageAllowedMimeType {
  return (
    typeof value === "string" &&
    IMAGE_ALLOWED_MIME_TYPES.some((mimeType) => mimeType === value)
  );
}

function createImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ClientImageProcessingError("Failed to read image file."));
    };
    image.src = objectUrl;
  });
}

function getTargetDimensions(
  originalWidth: number,
  originalHeight: number,
): { width: number; height: number } {
  const longestSide = Math.max(originalWidth, originalHeight);
  const scale =
    longestSide > IMAGE_MAX_OUTPUT_DIMENSION
      ? IMAGE_MAX_OUTPUT_DIMENSION / longestSide
      : 1;

  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new ClientImageProcessingError(
              `Failed to generate ${mimeType.toUpperCase()} image.`,
            ),
          );
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function stripExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index <= 0) {
    return fileName;
  }
  return fileName.slice(0, index);
}

export async function prepareImageForUpload(
  file: File,
): Promise<PreparedImageUpload> {
  if (!isAllowedInputMimeType(file.type)) {
    throw new ClientImageProcessingError(
      "Only JPEG, PNG and WebP files are allowed.",
    );
  }

  if (file.size <= 0 || file.size > IMAGE_MAX_BYTES) {
    throw new ClientImageProcessingError("Input image must be 8 MB or smaller.");
  }

  const image = await createImageElement(file);

  if (
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0 ||
    image.naturalWidth > IMAGE_MAX_INPUT_DIMENSION ||
    image.naturalHeight > IMAGE_MAX_INPUT_DIMENSION
  ) {
    throw new ClientImageProcessingError(
      `Input dimensions must be between 1x1 and ${IMAGE_MAX_INPUT_DIMENSION}x${IMAGE_MAX_INPUT_DIMENSION}.`,
    );
  }

  const { width, height } = getTargetDimensions(
    image.naturalWidth,
    image.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ClientImageProcessingError("Canvas 2D context is not available.");
  }

  // Rendering to canvas strips source metadata (including EXIF).
  context.drawImage(image, 0, 0, width, height);

  const [webpBlob, jpegBlob] = await Promise.all([
    canvasToBlob(canvas, "image/webp", 0.8),
    canvasToBlob(canvas, "image/jpeg", 0.82),
  ]);

  const baseName = stripExtension(file.name) || "image";
  const processedWebpFile = new File([webpBlob], `${baseName}.webp`, {
    type: "image/webp",
  });
  const processedJpegFile = new File([jpegBlob], `${baseName}.jpg`, {
    type: "image/jpeg",
  });

  return {
    originalFile: file,
    processedWebpFile,
    processedJpegFile,
    outputWidth: width,
    outputHeight: height,
  };
}

