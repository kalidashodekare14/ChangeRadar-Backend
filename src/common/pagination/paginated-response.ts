export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Return this from list handlers so the global interceptor emits `meta`. */
export class PaginatedData<T> {
  constructor(
    readonly items: T[],
    readonly meta: PaginationMeta,
  ) {}
}

export function paginate<T>(items: T[], meta: PaginationMeta): PaginatedData<T> {
  return new PaginatedData(items, meta);
}
