import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

// Key delivery check (build order step 1). This server starts without the keys so that it can report their absence.
// A value still holding its `${user_config.*}` placeholder means the host did not substitute it, so it counts as absent.
const present = (name: string) => {
    const value = process.env[name]?.trim();
    return Boolean(value) && !value!.startsWith('${');
};

serveStdio(() => {
    const server = new McpServer({ name: 'cin7-core', version: '0.0.1' });
    server.registerTool(
        'ping',
        {
            description: 'Report whether both Cin7 keys reached the server, without showing them.',
            annotations: { readOnlyHint: true }
        },
        async () => ({
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        accountIdPresent: present('CIN7_ACCOUNT_ID'),
                        applicationKeyPresent: present('CIN7_APPLICATION_KEY')
                    })
                }
            ]
        })
    );
    return server;
});
console.error('cin7-core: ping server is listening on stdio');
