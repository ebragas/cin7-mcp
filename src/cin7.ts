const BASE_URL = 'https://inventory.dearsystems.com/ExternalApi/v2/';
const TIMEOUT_MS = 30_000;
const RETRY_WAIT_MS = 5_000;

/** Every list page is fixed at this many rows. */
export const PAGE_SIZE = 100;

/** An error whose message is safe to show to the person using the tool. */
export class Cin7Error extends Error {
    override name = 'Cin7Error';
}

export type Cin7Params = Record<string, string | number | undefined>;

export interface Cin7Client {
    /** GET a path under the v2 base URL and return the parsed JSON body. */
    get(path: string, params?: Cin7Params): Promise<unknown>;
}

export interface Cin7ClientOptions {
    accountId: string;
    applicationKey: string;
    fetch?: typeof globalThis.fetch;
    sleep?: (ms: number) => Promise<void>;
}

const isRateLimited = (status: number) => status === 429 || status === 503;

export function createCin7Client(options: Cin7ClientOptions): Cin7Client {
    const { accountId, applicationKey } = options;
    const fetch = options.fetch ?? globalThis.fetch;
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

    const redact = (text: string) => text.replaceAll(accountId, '[redacted]').replaceAll(applicationKey, '[redacted]');

    async function request(url: URL): Promise<{ status: number; text: string }> {
        try {
            const response = await fetch(url, {
                headers: {
                    'api-auth-accountid': accountId,
                    'api-auth-applicationkey': applicationKey,
                    accept: 'application/json'
                },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
            return { status: response.status, text: await response.text() };
        } catch {
            // The cause is dropped on purpose: a fetch error can carry the request it failed on.
            throw new Cin7Error('Cin7 could not be reached.');
        }
    }

    return {
        async get(path, params = {}) {
            const url = new URL(path, BASE_URL);
            for (const [name, value] of Object.entries(params)) {
                if (value !== undefined) url.searchParams.set(name, String(value));
            }

            let response = await request(url);
            if (isRateLimited(response.status)) {
                console.error(`cin7-core: HTTP ${response.status} from ${url.pathname}, retrying in 5 seconds`);
                await sleep(RETRY_WAIT_MS);
                response = await request(url);
            }

            const { status, text } = response;
            if (isRateLimited(status)) throw new Cin7Error("Cin7's rate limit was reached. Try again in a minute.");
            if (status === 403) {
                throw new Cin7Error(
                    'Cin7 rejected the credentials. Check the Account ID and Application Key in the extension settings.'
                );
            }
            if (status !== 200) throw new Cin7Error(`Cin7 returned HTTP ${status}: ${redact(text)}`);

            try {
                return JSON.parse(text);
            } catch {
                throw new Cin7Error('Cin7 returned a response that is not JSON.');
            }
        }
    };
}
