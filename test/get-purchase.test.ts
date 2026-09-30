import { describe, expect, it, vi } from 'vitest';
import { getPurchase, mapPurchase } from '../src/tools/get-purchase';
import detail from './fixtures/advanced-purchase.json';
import list from './fixtures/purchase-list.json';

const putAwayReceipt = {
    sku: 'Assembly One',
    name: 'Assembly One',
    quantity: 3,
    date: '2018-04-02T00:00:00',
    location: 'Main Warehouse'
};

describe('mapPurchase', () => {
    it('maps the header and the ordered lines', () => {
        const { lines, receipts, ...header } = mapPurchase(detail);

        expect(header).toEqual({
            id: '78f64a2d-f339-4f0d-b29e-28646d05093d',
            orderNumber: 'PO-00069',
            type: 'Advanced Purchase',
            supplier: 'Carlton Technical Books',
            status: 'CREDITED',
            orderDate: '2018-04-05T00:00:00',
            requiredBy: null,
            location: 'Main Warehouse',
            receivingStatus: 'FULLY RECEIVED',
            currency: 'USD',
            total: 840,
            note: '2369h'
        });
        expect(lines).toEqual([{ sku: 'Assembly One', name: 'Assembly One', quantity: 3, price: 280, total: 840 }]);
        expect(receipts).toHaveLength(1);
    });

    it('takes receipts from PutAway', () => {
        expect(mapPurchase(detail).receipts).toEqual([putAwayReceipt]);
    });

    it('falls back to StockReceived when PutAway is empty', () => {
        const result = mapPurchase({ ...detail, PutAway: [] });

        expect(result.receipts).toEqual([{ ...putAwayReceipt, location: null }]);
    });

    it('falls back to StockReceived when PutAway holds no lines', () => {
        const result = mapPurchase({ ...detail, PutAway: [{ ...detail.PutAway[0]!, Lines: [] }] });

        expect(result.receipts).toEqual([{ ...putAwayReceipt, location: null }]);
    });

    it('skips NOT AVAILABLE sections in both lists', () => {
        const notAvailable = <T extends { Status: string }>(sections: T[]) =>
            sections.map(section => ({ ...section, Status: 'NOT AVAILABLE' }));

        expect(mapPurchase({ ...detail, PutAway: notAvailable(detail.PutAway) }).receipts).toEqual([
            { ...putAwayReceipt, location: null }
        ]);
        expect(
            mapPurchase({
                ...detail,
                PutAway: notAvailable(detail.PutAway),
                StockReceived: notAvailable(detail.StockReceived)
            }).receipts
        ).toEqual([]);
    });

    it('collects lines from every available section', () => {
        const second = { ...detail.PutAway[0]!, Lines: [{ ...detail.PutAway[0]!.Lines[0]!, Quantity: 2, Location: 'Annex' }] };

        const result = mapPurchase({ ...detail, PutAway: [...detail.PutAway, second] });

        expect(result.receipts).toEqual([putAwayReceipt, { ...putAwayReceipt, quantity: 2, location: 'Annex' }]);
    });
});

describe('getPurchase', () => {
    const [first, second] = list.PurchaseList as [(typeof list.PurchaseList)[0], (typeof list.PurchaseList)[0]];

    function client(listResponse: unknown = list) {
        const get = vi.fn(async (path: string) => (path === 'purchaseList' ? listResponse : detail));
        return { get };
    }

    it.each([
        ['both', { orderNumber: 'PO-00026', id: 'abc' }],
        ['neither', {}],
        ['blank values', { orderNumber: ' ', id: '' }]
    ])('rejects a call that gives %s of orderNumber and id', async (_label, input) => {
        const cin7 = client();

        await expect(getPurchase(cin7, input)).rejects.toThrow('exactly one of orderNumber or id');
        expect(cin7.get).not.toHaveBeenCalled();
    });

    it('fetches detail by id in one request', async () => {
        const cin7 = client();

        const result = await getPurchase(cin7, { id: '78f64a2d-f339-4f0d-b29e-28646d05093d' });

        expect(cin7.get).toHaveBeenCalledExactlyOnceWith('advanced-purchase', {
            ID: '78f64a2d-f339-4f0d-b29e-28646d05093d'
        });
        expect(result).toMatchObject({ orderNumber: 'PO-00069', receipts: [putAwayReceipt] });
    });

    it('resolves one exact order number match, ignoring letter case, then fetches detail', async () => {
        const cin7 = client();

        const result = await getPurchase(cin7, { orderNumber: 'po-00080' });

        expect(cin7.get.mock.calls).toEqual([
            ['purchaseList', { Search: 'po-00080', Limit: 100 }],
            ['advanced-purchase', { ID: second.ID }]
        ]);
        expect(result).toMatchObject({ orderNumber: 'PO-00069' });
    });

    it('returns near matches when no purchase has that exact order number', async () => {
        const cin7 = client();

        const result = await getPurchase(cin7, { orderNumber: 'PO-000' });

        expect(cin7.get).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            note: 'No purchase has the exact order number "PO-000".',
            nearMatches: [
                { orderNumber: 'PO-00026', supplier: 'Bayside Club' },
                { orderNumber: 'PO-00080', supplier: 'Bayside Wholesale' }
            ]
        });
    });

    it('returns no near matches when the search finds nothing', async () => {
        const cin7 = client({ Total: 0, Page: 1, PurchaseList: [] });

        const result = await getPurchase(cin7, { orderNumber: 'PO-99999' });

        expect(result).toEqual({ note: 'No purchase has the exact order number "PO-99999".', nearMatches: [] });
    });

    it('says when the search overflowed its single page', async () => {
        const cin7 = client({ ...list, Total: 140 });

        const result = await getPurchase(cin7, { orderNumber: 'PO-000' });

        expect(result).toMatchObject({ note: expect.stringContaining('first 100 of 140') });
    });

    it('lists the candidates and asks for an id when several purchases share the order number', async () => {
        const twin = { ...second, ID: 'twin-id', OrderNumber: 'po-00026', Supplier: 'Other Supplier' };
        const cin7 = client({ ...list, Total: 3, PurchaseList: [first, second, twin] });

        const result = await getPurchase(cin7, { orderNumber: 'PO-00026' });

        expect(cin7.get).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            note: expect.stringContaining('Call get_purchase again with the id'),
            candidates: [
                { id: first.ID, orderNumber: 'PO-00026', supplier: 'Bayside Club' },
                { id: 'twin-id', orderNumber: 'po-00026', supplier: 'Other Supplier' }
            ]
        });
    });
});
