import { Query, QueryResult, Table } from '@synthql/queries';
import { useSynthqlContext } from './SynthqlProvider';
import { useAyncGeneratorQuery } from './useAsyncGeneratorQuery';
import { synthqlQueryKey } from './synthqlQueryKey';
import { QueryOptions, UseQueryResult } from '@tanstack/react-query';
import { fetchJsonLines } from './fetchJsonLines';

type SynthqlQueryOptions<
    DB,
    TTable extends Table<DB>,
    TQuery extends Query<DB, TTable>,
> = {
    requestInit?: RequestInit;
    reactQuery?: Pick<QueryOptions<QueryResult<DB, TQuery>>, 'retry'>;
};

export function useSynthql<
    DB,
    TTable extends Table<DB>,
    TQuery extends Query<DB, TTable>,
>(
    query: TQuery,
    opts: SynthqlQueryOptions<DB, TTable, TQuery> = {},
): UseQueryResult<QueryResult<DB, TQuery>> {
    const { endpoint, requestInit } = useSynthqlContext();

    const mergedRequestInit: RequestInit = {
        ...requestInit,
        ...opts.requestInit,
        body: JSON.stringify(query),
    };

    const queryKey = synthqlQueryKey<DB, TTable, TQuery>(query, {
        endpoint: endpoint,
        requestInit: mergedRequestInit,
    });

    return useAyncGeneratorQuery({
        queryKey,
        queryFn: async () => {
            return fetchJsonLines<QueryResult<DB, TQuery>>(
                endpoint,
                mergedRequestInit,
            );
        },
        ...opts.reactQuery,
    });
}
