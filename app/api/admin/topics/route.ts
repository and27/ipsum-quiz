import type { AdminTopicCreateRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { createTopic, listTopics, TopicInputError } from "@/lib/usecases/topics";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") !== "false";
    const topics = await listTopics({ includeInactive });
    return NextResponse.json({ items: topics });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json({ error: "Failed to list topics." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body) || typeof body.name !== "string") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminTopicCreateRequest = { name: body.name };
    const topic = await createTopic(payload.name);
    return NextResponse.json({ topic }, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof TopicInputError) {
      if (error.code === "duplicate_active_name") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      if (error.code === "invalid_name") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to create topic." }, { status: 500 });
  }
}
