import { PAGE_SIZE } from '../cin7';

/** The note for a list page: the next page when more exist, or `emptyNote` when there are zero rows. */
export function pagingNote(total: number, page: number, rowCount: number, emptyNote: string): { note?: string } {
    if (total > page * PAGE_SIZE) {
        return { note: `More results exist (${total} in total). Call again with page ${page + 1} for the next ${PAGE_SIZE}.` };
    }
    if (rowCount === 0) return { note: emptyNote };
    return {};
}
