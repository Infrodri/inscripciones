export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(query: { page?: unknown; pageSize?: unknown }): PaginationParams {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(query.pageSize ?? 20) || 20));
  return { page, pageSize };
}

export function paginatedResponse<T>(items: T[], total: number, params: PaginationParams) {
  return {
    data: items,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}
