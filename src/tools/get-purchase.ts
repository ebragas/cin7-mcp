import * as z from 'zod/v4';
import type { Cin7Client } from '../cin7';
import type { PurchaseListResponse } from './list-purchases';

export const name = 'get_purchase';

export const description =
    'What is on one purchase order and what has arrived: the header, the ordered lines and the received lines, each ' +
    'with its SKU. Give exactly one of orderNumber or id. Receipts are a plain list of received lines; compare them ' +
    'with the ordered lines to see what is outstanding. A Service Purchase holds charges only, so its lines are empty.';

export const inputSchema = z.object({
    orderNumber: z.string().optional().describe('Exact purchase order number, for example PO-00069'),
    id: z.string().optional().describe('Cin7 purchase ID, from the id field of list_purchases')
});

interface ReceiptLine {
    SKU?: string | null;
    Name?: string | null;
    Quantity?: number | null;
    Date?: string | null;
    Location?: string | null;
}

interface ReceiptSection {
    Status?: string | null;
    Lines?: ReceiptLine[] | null;
}

interface OrderLine {
    SKU?: string | null;
    Name?: string | null;
    Quantity?: number | null;
    Price?: number | null;
    Total?: number | null;
}

interface AdvancedPurchaseResponse {
    ID?: string | null;
    OrderNumber?: string | null;
    Type?: string | null;
    Supplier?: string | null;
    Status?: string | null;
    OrderDate?: string | null;
    RequiredBy?: string | null;
    Location?: string | null;
    CombinedReceivingStatus?: string | null;
    SupplierCurrency?: string | null;
    Note?: string | null;
    Order?: { Lines?: OrderLine[] | null; Total?: number | null } | null;
    StockReceived?: ReceiptSection[] | null;
    PutAway?: ReceiptSection[] | null;
}

const NOT_RECEIVED_STATUSES = new Set(['NOT AVAILABLE', 'DRAFT', 'VOIDED']);

function receiptLines(sections: ReceiptSection[] | null | undefined) {
    if (!Array.isArray(sections)) return [];
    return sections
        // NOT AVAILABLE is a stage that has not happened, DRAFT is a receipt that is entered but not yet
        // authorised, and VOIDED is a receipt that was undone. None of them is stock that has arrived.
        .filter(section => !NOT_RECEIVED_STATUSES.has(section.Status ?? ''))
        .flatMap(section => section.Lines ?? [])
        .map(line => ({
            sku: line.SKU ?? null,
            name: line.Name ?? null,
            quantity: line.Quantity ?? null,
            date: line.Date ?? null,
            location: line.Location ?? null
        }));
}

export function mapPurchase(purchase: AdvancedPurchaseResponse) {
    const putAway = receiptLines(purchase.PutAway);
    return {
        id: purchase.ID ?? null,
        orderNumber: purchase.OrderNumber ?? null,
        type: purchase.Type ?? null,
        supplier: purchase.Supplier ?? null,
        status: purchase.Status ?? null,
        orderDate: purchase.OrderDate ?? null,
        requiredBy: purchase.RequiredBy ?? null,
        location: purchase.Location ?? null,
        receivingStatus: purchase.CombinedReceivingStatus ?? null,
        currency: purchase.SupplierCurrency ?? null,
        total: purchase.Order?.Total ?? null,
        note: purchase.Note ?? null,
        lines: (purchase.Order?.Lines ?? []).map(line => ({
            sku: line.SKU ?? null,
            name: line.Name ?? null,
            quantity: line.Quantity ?? null,
            price: line.Price ?? null,
            total: line.Total ?? null
        })),
        receipts: putAway.length > 0 ? putAway : receiptLines(purchase.StockReceived)
    };
}

/** The order number search reads one page, so it asks for the largest page Cin7 serves. */
const LOOKUP_LIMIT = 1000;

type OrderNumberLookup =
    | { id: string }
    | { note: string; nearMatches: Array<{ orderNumber: string | null; supplier: string | null }> }
    | { note: string; candidates: Array<{ id: string | null; orderNumber: string | null; supplier: string | null }> };

/** Picks the purchase whose order number equals `orderNumber` out of a `Search` result, which matches by substring. */
export function resolveOrderNumber(response: PurchaseListResponse, orderNumber: string): OrderNumberLookup {
    const rows = response.PurchaseList ?? [];
    const wanted = orderNumber.toLowerCase();
    const exact = rows.filter(row => row.OrderNumber?.toLowerCase() === wanted);

    const [only] = exact;
    if (exact.length === 1 && only?.ID) return { id: only.ID };

    if (exact.length > 1) {
        return {
            note: `${exact.length} purchases have the order number "${orderNumber}". Call get_purchase again with the id of the one you want.`,
            candidates: exact.map(row => ({
                id: row.ID ?? null,
                orderNumber: row.OrderNumber ?? null,
                supplier: row.Supplier ?? null
            }))
        };
    }

    const total = response.Total ?? rows.length;
    const overflow =
        total > rows.length
            ? ` Only the first ${rows.length} of ${total} search results were checked, so the purchase may still exist. Find its id with list_purchases and call get_purchase with that id.`
            : '';
    return {
        note: `No purchase has the exact order number "${orderNumber}".${overflow}`,
        nearMatches: rows.map(row => ({ orderNumber: row.OrderNumber ?? null, supplier: row.Supplier ?? null }))
    };
}

export async function getPurchase(cin7: Cin7Client, input: z.infer<typeof inputSchema>) {
    const orderNumber = input.orderNumber?.trim();
    const id = input.id?.trim();
    if (Boolean(orderNumber) === Boolean(id)) {
        throw new Error('Give exactly one of orderNumber or id.');
    }

    let purchaseId = id;
    if (orderNumber) {
        const list = await cin7.get('purchaseList', { Search: orderNumber, Limit: LOOKUP_LIMIT });
        const lookup = resolveOrderNumber(list as PurchaseListResponse, orderNumber);
        if (!('id' in lookup)) return lookup;
        purchaseId = lookup.id;
    }

    // What Cin7 answers for an unknown ID is undocumented, so a 200 without a purchase in it reads as not found.
    const purchase = (await cin7.get('advanced-purchase', { ID: purchaseId })) as AdvancedPurchaseResponse | null;
    if (!purchase?.ID) return { note: `No purchase has the id "${purchaseId}".` };
    return mapPurchase(purchase);
}
