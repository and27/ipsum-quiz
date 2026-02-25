import type { PaginatedResult } from "@/lib/domain/common";
import type { Simulator, SimulatorStatus } from "@/lib/domain/simulator";

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

