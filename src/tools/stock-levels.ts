import * as z from 'zod/v4';
import { PAGE_SIZE, type Cin7Client } from '../cin7';
import { pagingNote } from './paging';

export const name = 'get_stock_levels';

export const description =
    'How many of a product are in stock, where, and how many are on order. Returns one row per product, location, bin ' +
    'and batch, so a product stocked in several places returns several rows. Quantities are as Cin7 Core reports them. ' +
    `Each page holds up to ${PAGE_SIZE} rows.`;

export const inputSchema = z.object({
    sku: z.string().optional().describe('Exact SKU'),
    name: z.string().optional().describe('Product name prefix'),
    location: z.string().optional().describe('Location name'),
    page: z.number().int().min(1).optional().describe('Page number, default 1')
});

interface ProductAvailabilityRow {
    SKU?: string | null;
    Name?: string | null;
    Location?: string | null;
    Bin?: string | null;
    Batch?: string | null;
    OnHand?: number | null;
    Allocated?: number | null;
    Available?: number | null;
    OnOrder?: number | null;
    InTransit?: number | null;
    NextDeliveryDate?: string | null;
}

interface ProductAvailabilityResponse {
    Total?: number;
    Page?: number;
    ProductAvailabilityList?: ProductAvailabilityRow[] | null;
}

/** `requestedPage` stands in for the page number when Cin7 leaves `Page` out of the body. */
export function mapStockLevels(response: ProductAvailabilityResponse | null, requestedPage = 1) {
    const rows = (response?.ProductAvailabilityList ?? []).map(row => ({
        sku: row.SKU ?? null,
        name: row.Name ?? null,
        location: row.Location ?? null,
        bin: row.Bin ?? null,
        batch: row.Batch ?? null,
        onHand: row.OnHand ?? null,
        allocated: row.Allocated ?? null,
        available: row.Available ?? null,
        onOrder: row.OnOrder ?? null,
        inTransit: row.InTransit ?? null,
        nextDeliveryDate: row.NextDeliveryDate ?? null
    }));
    const total = response?.Total ?? rows.length;
    const page = response?.Page ?? requestedPage;
    return {
        rows,
        total,
        page,
        ...pagingNote(total, page, rows.length, 'No stock rows matched. A product with no stock record may not appear.')
    };
}

export async function getStockLevels(cin7: Cin7Client, input: z.infer<typeof inputSchema>) {
    const page = input.page ?? 1;
    const response = await cin7.get('ref/productavailability', {
        Sku: input.sku,
        Name: input.name,
        Location: input.location,
        Page: page,
        Limit: PAGE_SIZE
    });
    return mapStockLevels(response as ProductAvailabilityResponse, page);
}
