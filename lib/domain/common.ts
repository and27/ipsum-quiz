export type UUID = string;

export type ISODateTimeString = string;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  meta: PaginationMeta;
}

