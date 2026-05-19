export const PAGINATION_PAGE_SIZE = 10;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize = PAGINATION_PAGE_SIZE,
): { items: T[]; meta: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}

export function buildPaginationFooter(
  meta: PaginationMeta,
  command: string,
  pageFlag = '--page',
): string {
  const parts: string[] = [];
  const pageArg = (n: number) =>
    pageFlag ? `${command} ${pageFlag} ${n}` : `${command} ${n}`;

  if (meta.hasPrev) parts.push(`\`${pageArg(meta.page - 1)}\` ◀ Prev`);
  parts.push(
    `Page **${meta.page}** / ${meta.totalPages} (${meta.total} total)`,
  );
  if (meta.hasNext) parts.push(`Next ▶ \`${pageArg(meta.page + 1)}\``);

  return parts.join('  •  ');
}
