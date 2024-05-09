import { QueryEngine, createExpressSynthqlHandler } from '@synthql/backend';
import http from 'http';

import { DB } from './db';
import { appendBody } from './appendBody';

export interface PagilaServer {
    url: string;
    server: http.Server;
}

export function createPagilaServer({
    queryEngine,
}: {
    queryEngine: QueryEngine<DB>;
}): Promise<PagilaServer> {
    return new Promise((resolve, reject) => {
        const handler = createExpressSynthqlHandler<DB>(queryEngine);

        const nodeHandler = appendBody(handler);

        const server = http.createServer(nodeHandler);

        server.listen(() => {
            const address = server.address();

            if (typeof address === 'string' || address === null) {
                reject('Failed to get server address: ' + address);
            } else {
                resolve({
                    url: `http://localhost:${address.port}`,
                    server,
                });
            }
        });
    });
}
