import { PAGE_SIZE } from '../cin7';

/** The note for a list page: the next page when more exist, or `emptyNote` when nothing matched. */
export function pagingNote(total: number, page: number, rowCount: number, emptyNote: string): { note?: string } {
    if (total > page * PAGE_SIZE) {
        return { note: `More results exist (${total} in total). Call again with page ${page + 1} for the next ${PAGE_SIZE}.` };
    }
    if (rowCount === 0 && total > 0) {
        return {
            note: `Page ${page} is past the last page. There are ${total} results, on pages 1 to ${Math.ceil(total / PAGE_SIZE)}.`
        };
    }
    if (rowCount === 0) return { note: emptyNote };
    return {};
}
