import { QueryProvider } from '../../QueryProvider';
import { AnyQuery } from '../../types';
import { RefContext, createRefContext } from '../../refs/RefContext';
import { QueryExecutor } from '../types';
import { ColumnRef } from '../../refs/ColumnRef';
import { Table } from '@synthql/queries';

export class QueryProviderExecutor<DB> implements QueryExecutor {
    private providersByTable: Map<string, QueryProvider<DB, Table<DB>>>;

    constructor(providers: QueryProvider<DB, Table<DB>>[]) {
        this.providersByTable = new Map(providers.map((p) => [p.table, p]));
    }

    execute(query: AnyQuery): Promise<Array<any>> {
        const provider = this.providersByTable.get(query.from);

        if (!provider) {
            throw new Error(`No provider for table ${query.from}`);
        }

        return provider.execute(query);
    }

    canExecute<TQuery extends AnyQuery>(
        query: TQuery,
    ): { query: TQuery; remaining: TQuery[] } | undefined {
        const isSupported = this.providersByTable.has(query.from);

        if (!isSupported) {
            return undefined;
        }

        const queryWithoutChildren: TQuery = {
            ...query,
            include: {},
        };

        const remaining = Object.values(query.include ?? {}) as TQuery[];

        return { query: queryWithoutChildren, remaining };
    }

    collectRefValues(row: any, columns: ColumnRef[]): RefContext {
        const refContext = createRefContext();
        for (const column of columns) {
            const value = row[column.column];
            refContext.addValues(column, value);
        }

        return refContext;
    }
}
