import type { AdminImageUploadResponse } from "@/lib/domain/contracts";
import type { ImageAssetEntityType } from "@/lib/domain/image-asset";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { ImageUploadError, uploadProcessedImageAsset } from "@/lib/usecases/images";
import { NextRequest, NextResponse } from "next/server";

function isImageAssetEntityType(value: unknown): value is ImageAssetEntityType {
  return value === "question" || value === "option";
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const formData = await request.formData();

    const entityType = formData.get("entityType");
    const originalFile = formData.get("original");
    const processedWebpFile = formData.get("processedWebp");
    const processedJpegFile = formData.get("processedJpeg");

    if (
      !isImageAssetEntityType(entityType) ||
      !(originalFile instanceof File) ||
      !(processedWebpFile instanceof File) ||
      !(processedJpegFile instanceof File)
    ) {
      return NextResponse.json(
        { error: "Payload de carga invalido." },
        { status: 400 },
      );
    }

    const asset = await uploadProcessedImageAsset({
      entityType,
      uploadedBy: session.userId,
      originalFile,
      processedWebpFile,
      processedJpegFile,
    });

    const response: AdminImageUploadResponse = { asset };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ImageUploadError) {
      if (
        error.code === "upload_failed" ||
        error.code === "persistence_failed"
      ) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo subir la imagen." },
      { status: 500 },
    );
  }
}

