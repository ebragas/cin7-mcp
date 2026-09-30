import { describe, expect, it, vi } from 'vitest';
import { Cin7Error, createCin7Client } from '../src/cin7';

const ACCOUNT_ID = 'acct-1234-secret';
const APPLICATION_KEY = 'key-5678-secret';

function setup(...responses: Array<Response | Error>) {
    const queue = [...responses];
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
        const next = queue.shift();
        if (!next) throw new Error('unexpected request');
        if (next instanceof Error) throw next;
        return next;
    });
    const sleep = vi.fn(async (_ms: number) => {});
    const client = createCin7Client({ accountId: ACCOUNT_ID, applicationKey: APPLICATION_KEY, fetch, sleep });
    return { client, fetch, sleep };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

async function failure(promise: Promise<unknown>): Promise<Cin7Error> {
    const error = await promise.then(
        () => undefined,
        (e: unknown) => e
    );
    expect(error).toBeInstanceOf(Cin7Error);
    return error as Cin7Error;
}

function expectNoKeys(text: string) {
    expect(text).not.toContain(ACCOUNT_ID);
    expect(text).not.toContain(APPLICATION_KEY);
}

describe('Cin7 client', () => {
    it('sends both auth headers to the v2 base URL and returns the parsed body', async () => {
        const { client, fetch } = setup(ok({ Total: 0 }));

        await expect(client.get('ref/productavailability')).resolves.toEqual({ Total: 0 });

        const [url, init] = fetch.mock.calls[0]!;
        expect(String(url)).toBe('https://inventory.dearsystems.com/ExternalApi/v2/ref/productavailability');
        const headers = new Headers(init?.headers);
        expect(headers.get('api-auth-accountid')).toBe(ACCOUNT_ID);
        expect(headers.get('api-auth-applicationkey')).toBe(APPLICATION_KEY);
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('builds the query string from defined parameters only, URL-encoded', async () => {
        const { client, fetch } = setup(ok({}));

        await client.get('purchaseList', { Search: 'PO 1&2', Status: undefined, Page: 2, Limit: 100 });

        const url = new URL(String(fetch.mock.calls[0]![0]));
        expect(url.pathname).toBe('/ExternalApi/v2/purchaseList');
        expect([...url.searchParams.entries()]).toEqual([
            ['Search', 'PO 1&2'],
            ['Page', '2'],
            ['Limit', '100']
        ]);
    });

    it('leaves out blank parameters, which would otherwise filter on an empty value', async () => {
        const { client, fetch } = setup(ok({}));

        await client.get('ref/productavailability', { Sku: '', Name: '  ', Location: 'Main', Page: 1 });

        const url = new URL(String(fetch.mock.calls[0]![0]));
        expect([...url.searchParams.keys()]).toEqual(['Location', 'Page']);
    });

    it('trims the values it sends', async () => {
        const { client, fetch } = setup(ok({}));

        await client.get('purchaseList', { Search: ' Bayside ' });

        expect(new URL(String(fetch.mock.calls[0]![0])).searchParams.get('Search')).toBe('Bayside');
    });

    it.each([429, 503])('waits 5 seconds and retries once on HTTP %i', async status => {
        const { client, fetch, sleep } = setup(new Response('busy', { status }), ok({ Total: 1 }));

        await expect(client.get('purchaseList')).resolves.toEqual({ Total: 1 });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledExactlyOnceWith(5000);
    });

    it.each([429, 503])('reports the rate limit when HTTP %i survives the retry', async status => {
        const { client, fetch } = setup(new Response('busy', { status }), new Response('busy', { status }));

        const error = await failure(client.get('purchaseList'));

        expect(error.message).toBe("Cin7's rate limit was reached. Try again in a minute.");
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('maps HTTP 403 to the credentials message without retrying', async () => {
        const { client, fetch } = setup(new Response('Incorrect credentials!', { status: 403 }));

        const error = await failure(client.get('purchaseList'));

        expect(error.message).toBe(
            'Cin7 rejected the credentials. Check the Account ID and Application Key in the extension settings.'
        );
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('passes the status code and response text through for any other non-200', async () => {
        const body = '[{"ErrorCode":400,"Exception":"Purchase not found"}]';
        const { client } = setup(new Response(body, { status: 400 }));

        const error = await failure(client.get('advanced-purchase', { ID: 'nope' }));

        expect(error.message).toContain('400');
        expect(error.message).toContain(body);
    });

    it('maps a network failure to the unreachable message', async () => {
        const { client } = setup(new TypeError(`fetch failed for ${APPLICATION_KEY}`));

        const error = await failure(client.get('purchaseList'));

        expect(error.message).toBe('Cin7 could not be reached.');
    });

    it('maps a timeout to the unreachable message', async () => {
        const { client } = setup(new DOMException('The operation timed out.', 'TimeoutError'));

        const error = await failure(client.get('purchaseList'));

        expect(error.message).toBe('Cin7 could not be reached.');
    });

    it('keeps the keys out of every error message, even when Cin7 echoes them', async () => {
        const echo = `bad key ${APPLICATION_KEY} for ${ACCOUNT_ID}`;
        const cases = [
            setup(new Response(echo, { status: 403 })),
            setup(new Response(echo, { status: 429 }), new Response(echo, { status: 429 })),
            setup(new Response(echo, { status: 500 })),
            setup(new Error(echo))
        ];

        for (const { client } of cases) {
            const error = await failure(client.get('purchaseList'));
            expectNoKeys(error.message);
            expectNoKeys(String(error.stack));
        }
    });
});
