import type { PaginatedResult } from "@/lib/domain/common";
import type {
  SimulatorCampus,
  Simulator,
  SimulatorPublishValidation,
  SimulatorStatus,
  SimulatorVersion,
  SimulatorVersionQuestion,
} from "@/lib/domain/simulator";

export interface AdminSimulatorsListQuery {
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export type AdminSimulatorsListResponse = PaginatedResult<Simulator>;

export interface AdminSimulatorCreateRequest {
  title: string;
  campus?: SimulatorCampus;
  description?: string | null;
  maxAttempts?: number;
  durationMinutes: number;
  isActive?: boolean;
  accessCode?: string | null;
}

export interface AdminSimulatorUpdateRequest {
  title?: string;
  campus?: SimulatorCampus;
  description?: string | null;
  maxAttempts?: number;
  durationMinutes?: number;
  isActive?: boolean;
  status?: SimulatorStatus;
  accessCode?: string | null;
}

export interface AdminSimulatorResponse {
  simulator: Simulator;
}

export interface AdminSimulatorBuilderStateResponse {
  simulator: Simulator;
  activeVersion: SimulatorVersion | null;
  draftVersion: SimulatorVersion | null;
  publishedVersion: SimulatorVersion | null;
  isEditable: boolean;
  lockReason: string | null;
  items: SimulatorVersionQuestion[];
}

export interface AdminSimulatorBuilderAddQuestionRequest {
  sourceQuestionId: string;
  sourceQuestionIds?: string[];
  position?: number;
}

export interface AdminSimulatorBuilderReorderQuestionRequest {
  position: number;
}

export interface AdminSimulatorBuilderQuestionResponse {
  item: SimulatorVersionQuestion;
}

export interface AdminSimulatorPublishValidationResponse {
  validation: SimulatorPublishValidation;
}

export interface AdminSimulatorPublishResponse {
  simulator: Simulator;
  publishedVersion: SimulatorVersion;
  validation: SimulatorPublishValidation;
}

export interface AdminSimulatorDuplicateVersionResponse {
  draftVersion: SimulatorVersion;
  copiedQuestions: number;
}
