import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createCin7Client } from './cin7';
import * as getPurchase from './tools/get-purchase';
import * as listPurchases from './tools/list-purchases';
import * as stockLevels from './tools/stock-levels';

// The one place the keys are read. A value still holding its `${user_config.*}` placeholder was never substituted
// by the host, so it counts as missing.
function readKey(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value && !value.startsWith('${') ? value : undefined;
}

const accountId = readKey('CIN7_ACCOUNT_ID');
const applicationKey = readKey('CIN7_APPLICATION_KEY');
if (!accountId || !applicationKey) {
    console.error('cin7-core: CIN7_ACCOUNT_ID and CIN7_APPLICATION_KEY are required');
    process.exit(1);
}

const cin7 = createCin7Client({ accountId, applicationKey });

/** Runs a tool and turns a failure into a tool error, so the person sees the message instead of a protocol error. */
async function run(tool: string, work: () => Promise<unknown>) {
    try {
        return { content: [{ type: 'text' as const, text: JSON.stringify(await work()) }] };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`cin7-core: ${tool} failed: ${message}`);
        return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
}

const annotations = { readOnlyHint: true };

serveStdio(() => {
    const server = new McpServer({ name: 'cin7-core', version: '0.1.1' });
    server.registerTool(
        stockLevels.name,
        { description: stockLevels.description, inputSchema: stockLevels.inputSchema, annotations },
        input => run(stockLevels.name, () => stockLevels.getStockLevels(cin7, input))
    );
    server.registerTool(
        listPurchases.name,
        { description: listPurchases.description, inputSchema: listPurchases.inputSchema, annotations },
        input => run(listPurchases.name, () => listPurchases.listPurchases(cin7, input))
    );
    server.registerTool(
        getPurchase.name,
        { description: getPurchase.description, inputSchema: getPurchase.inputSchema, annotations },
        input => run(getPurchase.name, () => getPurchase.getPurchase(cin7, input))
    );
    return server;
});
console.error('cin7-core: server is listening on stdio');
