import { describe, expect, it, vi } from 'vitest';
import { getStockLevels, mapStockLevels } from '../src/tools/stock-levels';
import fixture from './fixtures/product-availability.json';

describe('mapStockLevels', () => {
    it('maps every listed field, keeps nulls, and carries total and page through', () => {
        const result = mapStockLevels(fixture);

        expect(result.total).toBe(4);
        expect(result.page).toBe(1);
        expect(result.rows).toHaveLength(4);
        expect(result.rows[0]).toEqual({
            sku: 'test product 1',
            name: 'Test product 1',
            location: 'Main Warehouse',
            bin: null,
            batch: null,
            onHand: 0,
            allocated: 1,
            available: 1,
            onOrder: 0,
            inTransit: 0,
            nextDeliveryDate: '2024-11-22T00:00:00'
        });
        expect(result.rows[1]!.nextDeliveryDate).toBeNull();
        expect(result.rows[3]).toMatchObject({ sku: 'test product 4', allocated: 5, available: 2 });
    });

    it('reads a null body as zero rows', () => {
        expect(mapStockLevels(null)).toMatchObject({ rows: [], total: 0, page: 1 });
    });

    it('adds no note when the page holds every row', () => {
        expect(mapStockLevels(fixture)).not.toHaveProperty('note');
        expect(mapStockLevels({ ...fixture, Total: 100 })).not.toHaveProperty('note');
        expect(mapStockLevels({ ...fixture, Total: 200, Page: 2 })).not.toHaveProperty('note');
    });

    it('uses the requested page when Cin7 leaves Page out of the body', () => {
        const { Page: _page, ...withoutPage } = fixture;

        const result = mapStockLevels({ ...withoutPage, Total: 450 }, 3);

        expect(result.page).toBe(3);
        expect(result.note).toContain('page 4');
    });

    it('names the next page when more pages exist', () => {
        expect(mapStockLevels({ ...fixture, Total: 101 }).note).toContain('page 2');
        expect(mapStockLevels({ ...fixture, Total: 201, Page: 2 }).note).toContain('page 3');
    });

    it('says a product with no stock record may not appear when there are zero rows', () => {
        const result = mapStockLevels({ Total: 0, Page: 1, ProductAvailabilityList: [] });

        expect(result.rows).toEqual([]);
        expect(result.note).toContain('no stock record may not appear');
    });
});

describe('getStockLevels', () => {
    it('sends the filters under their Cin7 names with a fixed page size', async () => {
        const get = vi.fn(async () => fixture);

        const result = await getStockLevels({ get }, { sku: 'ABC-1', name: 'Wid', location: 'Main Warehouse', page: 3 });

        expect(get).toHaveBeenCalledExactlyOnceWith('ref/productavailability', {
            Sku: 'ABC-1',
            Name: 'Wid',
            Location: 'Main Warehouse',
            Page: 3,
            Limit: 100
        });
        expect(result.rows).toHaveLength(4);
    });

    it('defaults to page 1', async () => {
        const get = vi.fn(async () => fixture);

        await getStockLevels({ get }, {});

        expect(get).toHaveBeenCalledExactlyOnceWith('ref/productavailability', {
            Sku: undefined,
            Name: undefined,
            Location: undefined,
            Page: 1,
            Limit: 100
        });
    });
});
