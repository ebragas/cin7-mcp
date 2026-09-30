import { describe, expect, it, vi } from 'vitest';
import { listPurchases, mapPurchaseList } from '../src/tools/list-purchases';
import fixture from './fixtures/purchase-list.json';

describe('mapPurchaseList', () => {
    it('maps every listed field, with receivingStatus from CombinedReceivingStatus', () => {
        const result = mapPurchaseList(fixture);

        expect(result.total).toBe(2);
        expect(result.page).toBe(1);
        expect(result.rows).toEqual([
            {
                id: '60b75408-f432-407d-bc69-66a0df49bc4c',
                orderNumber: 'PO-00026',
                supplier: 'Bayside Club',
                status: 'INVOICED',
                orderDate: '2018-02-22T00:00:00',
                requiredBy: null,
                receivingStatus: 'NOT RECEIVED',
                invoiceAmount: 15,
                currency: 'USD',
                type: 'Simple Purchase'
            },
            {
                id: '4e60f55a-1690-4024-a58c-29d62106a645',
                orderNumber: 'PO-00080',
                supplier: 'Bayside Wholesale',
                status: 'COMPLETED',
                orderDate: '2018-04-12T00:00:00',
                requiredBy: null,
                receivingStatus: 'FULLY RECEIVED',
                invoiceAmount: 54.31,
                currency: 'USD',
                type: 'Simple Purchase'
            }
        ]);
        expect(result).not.toHaveProperty('note');
    });

    it('names the next page when more pages exist', () => {
        expect(mapPurchaseList({ ...fixture, Total: 250 }).note).toContain('page 2');
        expect(mapPurchaseList({ ...fixture, Total: 250, Page: 3 })).not.toHaveProperty('note');
    });

    it('adds a plain note when there are zero rows', () => {
        const result = mapPurchaseList({ Total: 0, Page: 1, PurchaseList: [] });

        expect(result.rows).toEqual([]);
        expect(result.note).toBe('No purchases matched.');
    });
});

describe('listPurchases', () => {
    it('sends the filters under their Cin7 names with a fixed page size', async () => {
        const get = vi.fn(async () => fixture);

        await listPurchases(
            { get },
            { search: 'Bayside', status: 'ORDERED', requiredBy: '2018-05-01', updatedSince: '2018-04-01', page: 2 }
        );

        expect(get).toHaveBeenCalledExactlyOnceWith('purchaseList', {
            Search: 'Bayside',
            Status: 'ORDERED',
            RequiredBy: '2018-05-01',
            UpdatedSince: '2018-04-01',
            Page: 2,
            Limit: 100
        });
    });
});
