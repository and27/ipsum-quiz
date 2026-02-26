import type { PaginatedResult } from "@/lib/domain/common";
import type {
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
  description?: string | null;
  maxAttempts?: number;
  durationMinutes: number;
  isActive?: boolean;
  accessCode?: string | null;
}

export interface AdminSimulatorUpdateRequest {
  title?: string;
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
  draftVersion: SimulatorVersion;
  items: SimulatorVersionQuestion[];
}

export interface AdminSimulatorBuilderAddQuestionRequest {
  sourceQuestionId: string;
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
