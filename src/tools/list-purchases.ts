import * as z from 'zod/v4';
import { PAGE_SIZE, type Cin7Client } from '../cin7';
import { pagingNote } from './paging';

export const name = 'list_purchases';

export const description =
    'What purchase orders exist, from which supplier, and when they are due. Known status values: DRAFT, VOIDED, ' +
    'ORDERING, ORDERED, RECEIVING, RECEIVED, INVOICED, CREDITED, RECEIVING / CREDITED, RECEIVED / CREDITED, ' +
    'PARTIALLY INVOICED, COMPLETED. There is no single "open" status: find open purchases by reading status and ' +
    `receivingStatus in the rows. Each page holds up to ${PAGE_SIZE} rows. Use get_purchase for the lines and receipts of one purchase.`;

export const inputSchema = z.object({
    search: z
        .string()
        .optional()
        .describe('Text contained in order number, supplier, status, invoice number or credit note number'),
    status: z.string().optional().describe('One purchase status'),
    requiredBy: z.string().optional().describe('Due on or before this date (ISO 8601)'),
    updatedSince: z.string().optional().describe('Changed after this date (ISO 8601)'),
    page: z.number().int().min(1).optional().describe('Page number, default 1')
});

export interface PurchaseListRow {
    ID?: string | null;
    OrderNumber?: string | null;
    Supplier?: string | null;
    Status?: string | null;
    OrderDate?: string | null;
    RequiredBy?: string | null;
    CombinedReceivingStatus?: string | null;
    InvoiceAmount?: number | null;
    SupplierCurrency?: string | null;
    Type?: string | null;
}

export interface PurchaseListResponse {
    Total?: number;
    Page?: number;
    PurchaseList?: PurchaseListRow[] | null;
}

/** `requestedPage` stands in for the page number when Cin7 leaves `Page` out of the body. */
export function mapPurchaseList(response: PurchaseListResponse | null, requestedPage = 1) {
    const rows = (response?.PurchaseList ?? []).map(row => ({
        id: row.ID ?? null,
        orderNumber: row.OrderNumber ?? null,
        supplier: row.Supplier ?? null,
        status: row.Status ?? null,
        orderDate: row.OrderDate ?? null,
        requiredBy: row.RequiredBy ?? null,
        receivingStatus: row.CombinedReceivingStatus ?? null,
        invoiceAmount: row.InvoiceAmount ?? null,
        currency: row.SupplierCurrency ?? null,
        type: row.Type ?? null
    }));
    const total = response?.Total ?? rows.length;
    const page = response?.Page ?? requestedPage;
    return { rows, total, page, ...pagingNote(total, page, rows.length, 'No purchases matched.') };
}

export async function listPurchases(cin7: Cin7Client, input: z.infer<typeof inputSchema>) {
    const page = input.page ?? 1;
    const response = await cin7.get('purchaseList', {
        Search: input.search,
        Status: input.status,
        RequiredBy: input.requiredBy,
        UpdatedSince: input.updatedSince,
        Page: page,
        Limit: PAGE_SIZE
    });
    return mapPurchaseList(response as PurchaseListResponse, page);
}
