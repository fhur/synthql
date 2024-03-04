# XQL

A full stack, type-safe client to your postgresql database with a focus on DX and performance.

XQL let's you query your database directly from the browser, helping you create large object graphs without the need for custom endpoints and using backend resources.

## Phylosophy

-   APIs support either 1M clients (e.g. Stripe) or 1-2 (Your typical BE API serving a browser & mobile app).
-   The client has the best knowledge on what API it needs.
-   The client knows which resources are needed at which time, thus providing valuable insight into building performant queries.
-   Graphql has lots of great ideas, but is way too complicated for most companies.

# Features

-   Type safe
-   Composable queries
-   Lazy streaming queries
-   Queries are plain data
-   Authorization
-   Full-stack
-   Caching layer

## Type safe

The SQX schema is auto-generated from your database's schema with a simple command:

```bash
npx sqx generate:schema
```

## Composable queries

SQX let's you build very large object graphs by composing smaller queries. The individual queries will be combined into a single, efficient SQL join.

Here's an example: Fetching OTS parts with manufacturers.

```ts
function manufacturer() {
    return query<DB>()
        .from('public.manufacturer')
        .select('id','name')
}
function otsPart() {
    const manufacturer = manufacturer()
        .where({ id: col('public.off_the_shelf_part.manufacturer') })
        .one()

    return query<DB>()
        .from('public.off_the_shelf_part'),
        .select('id','mpn')
        .include({ manufacturer })
}

function findPartOption() {
    const otsPart = otsPart()
        .where({ id: col('part_option.ots_part') })
        .many()

    return query<DB>()
        .from('part_option')
        .select('id')
        .include({
            otsPart,
            customPart: ...,
            ipn: ...
        })
}
```

## Lazy streaming queries

By default the entire query will be compiled into a single large SQL join. This will give good performance for small object graphs (say 1-5 levels deep), but as the object graph grows, so will the time it takes until the query is resolved and the data is eventually sent to the client.

To solve this problem, SQX let's you define lazy, streaming queries. A lazy query defines a boundary by which the SQX query is split into two separate SQL queries. As soon as the results for the first query are obtained the data is sent to the client.

Here's an example: Imagine you want to fetch all OTS parts with all the associated OTS offers. The parts can be fetched very quickly since there are only few of them per BOM (100-1000), but every part can have ~100 offers, so we're taking about (100.000 to 1.000.000) offers.

Loading 1M offers will be slow, no matter what you do, but by loading the offers asynchronously we can show some progress to the user while the offers are loaded in the background. Here's how that would look:

```ts
// First define a view on the OTS offers table
function otsOffers() {
    return query<DB>()
        .from('off_the_shelf_offers')
        .select('id','price_breaks','created_at')
}

function otsPart() {
    const part = ref<DB>()
        .table('public.off_the_shelf_part')
        .column('id')

    // Filter the offers by part ID,
    // but mark the query as .lazy()
    const offers = otsOffers()
        .where({ part })
        .lazy()
        .many()

    return query<DB>()
        .from('public.off_the_shelf_part'),
        .select('id','mpn')
        .include({
            offers,
            manufacturer: ...
        })
}
```

This will be sent to the client using JSONL, meaning one JSON.stringify per line

```json
// send the first line of JSON with the parts and manufacturers
[ { id: '1', mpn:'1', offers: {status:'pending'} }, ...  ]
// once the offers are loaded, sent the entire structure
[ { id: '1', mpn:'1', offers: { status:'done', offers: [...] } }, ...  ]
```

Lazy queries are a really powerful feature, and once you start thinking about them you will see them everywhere. Here's another example:

When you fetch an RFQ, you most likely also want to fetch the BOM structure, the design items,
and the sourcing scenarios, but you don't want to wait for all that data to load to render the
page. Lazy queries to the rescue:
You would load the RFQ eagerly, and lasily load the BOM structure, and the sourcing scenarios.

```
RFQ (eager)
    - Top level assembly (lazy)
        - Design items (eager)
    - Sourcing scenarios  (lazy)
        - Solutions (lazy)
        - Solution configs (eager)
```

## Queries are plain data

XQL queries are plain JS objects. As such they can be serialized, sent over the wire, etc.
This means you can compose queries directly from your FE, and send them securely to the BE
for execution. This is awesome as it means you get e2e type-safety (FE/BE/DB) with minimal
effort.

This is how queries look

```ts
{
    from: "other_tenant.off_the_shelf_offer",
    where: {
        id: { in: '$1' },
    },
    select: {
        id: true,
        mpn: true,
    },
    cardinality: 'many',
    include: {
        manufacturer: {...}
    },
    acl: ['view:users'],
}
```

Another cool thing about queries being _just data_ is that you can easily build functions
that operate on queries. For example, here's a function that takes a query as input and makes it lazy.

```ts
function lazy<T>(query): T & { lazy: true } {
    return { ...query, lazy: true };
}
```

Another example would be a function that restricts the parameters that are allowed on a query to the manufacturers table. You could use this query to make sure that clients don't filter by attributes that would cause a full table scan.

```ts
function checkParams(query: Query<DB, 'public.manufacturers'>) {
    const allowedParams = new Set(['id']);
    const params = Object.keys(query.where);
    for (const param of params) {
        if (!allowedParams.includes(param)) {
            throw new Error('You can only query public.manufacturers by ID');
        }
    }
}
```

## Authorization

ACL lists can be defined at the query/view level.
When the engine executes a query it will throw unless all the required permissions are met.

The following example defines a view on the users table indicating that queries
over this view can only be executed if the user has the 'view:users' permission.

## Column level security

```ts
const users() {
    query<DB>()
        .from('users')
        .acl(['view:users'])
        .select('id','name','email')
}
```

## Row level security

Customer => read rfqs, but not all
EMS => read all RFQs

```ts
function enforceRfqAccessPermissions(query, userType) {
    if (userType === 'ems') {
        return query;
    }
    if (userType === 'customer') {
        return {
            ...query,
            where: {
                ...query.where,
                customer_id: user.id,
            },
        };
    }
    throw Error('unknown');
}
```

## Full-stack

Queries & views can be shared between node and the browser.

This means queries can be composed in the client, and sent to the BE to execute. You get type-safety e2e without having to spend BE resources building endpoints.

## Caching

```
{
  ['public.manufacturers'+'id']: {...},
  ['public.off_the_shelf_offers'+'id']: {...},
  ['public.suppliers'+ 'a']: {...}
}
```

Limitation: you can only make joins by IDs.

```
- OTS parts
- Table A (references Ots parts)
- Table B (references Ots parts)

select
from tableA
left join tableB on tableA.ots_part_id = tableB.ots_part_id
```

## Custom providers

```json
{
    from: "bom_warnings",
    where: {...},
    select: {}
}
```

```ts
const queryEngine = new QueryEngine(..., virtualQueries: {
    bom_warnings: (query) => {
        http('GET /some_geneated_object')
    }
});
queryEngine.execute(query)
```

## What happens when you change the schema (e.g. run migrations)

-   Drop table => drop FE
-   Rename col/table => rename the XQL queries
-   Columns added => no change needed
-   Change structure of JSONB fields => TSC wouldn't know

## Architecture

```
packages/queries <= definition of all the queries (CODEOWNERS with BE people)
packages/app     <= frontend imports queries package
packages/gateway <= executes queries
```

FE

```ts
useXql(bigQuery);
```

BE

```
POST /xql
```

## Easy to integrate with React Query

```ts
function useXql<TTable extends Table<DB>>(
    query: Query<DB, TTable>,
    queryProps,
) {
    return useQuery({
        queryKey: xqlQuery(query.table, query),
        queryFn: () => {
            return engine.execute(theQuery);
        },
        ...queryProps,
    });
}

export function xqlQuery<TTable extends Table<DB>>(
    table: TTable,
    query?: Query<DB, TTable>,
) {
    if (query) {
        return [table, query];
    }
    return [table];
}
```

This way you can easily invalidate queries to a `table`

# What is XQL not good for?

## Public facing APIs

As XQL queries are tightly coupled to your database schema, it means that when you
change your database schema you also need to update your clients.

For this reason, we do not recommend using XQL for public facing APIs that have long
migration windows.

## Analytical loads

XQL is optimized for transactional queries. Analytical loads will likely have poor performance.

## DB checks / constraints are not reflected in the XQL schema

-   TODO

# How does XQL compare against ...?

# Tomas' thoughts

-   Security aspect: exposing DB internals.
    -   Not fetching data from a different schema
-   Performance: FE doesn't know DB perf.
-   Understanding/debugging peformance problems.
-   Prepared queries?
-   Dog fooding of public facing APIs will no longer happen.
-   What problem does it solve?
    -   FE being blocked by BE
    -   Friction might shift to DB changes breaking FE.
    -   Fernando:
        -   Development speed
        -   FE join problem: speed & complexity problem.
-   Tomas doesn't hate it
-   Two languages: not that big of an issue.
-   Next steps?
    -   Think about security.
    -   Think about ways of giving evidence of development speed gains
        -   Is querying existing data in new ways so common?
    -   Think about schema changes and their impact

# Timon's thoughts

-   What does Fernando think is risky?
    -   New tech
    -   Maybe perf is not as good as I think will be
    -   Implementation taking too long
    -   Permission sync
-   Doen't hate it.
-   Get more thoughts from engineers.

# Tok's thoughts

-   Mostly for reads? yes
-   Business logic?
    -   I'm not opposed to having biz logic in the client.
-   Column level security?
-   Row level security?
    -   fn(query) => more restricted query by adding where's
-   How to support business logic?
-   Kick out the BE:
    -   ebpf: write custom modules you can import into the kernel at runtime
    -   Examples: only allow user to fetch calculation summary:

# Chris' Thoughts

-   Server side rendering? This assumes client side rendering.
-   If in a year React has server rendered components, what will the implications be?
-   Caching layer is not compatible with server side rendering.
-   Like Drizzle in that it compiles to a single SQL query.
-   Exposes DB structure. What's the risk of that?
-   Biggest risk:
    -   Support / maintenance? => just fhur
    -   Untried / not battle tested.
-   Biggest gain:
    -   Reducing the need for backend resources to implement features.
    -   Faster iteration times.
-   Cuts layers, less code required.
-   What kind of demo would blow your mind?
    -   Calculation table
    -   Manfuacturing scenario page (http://localhost:3000/rfqs/6aecd801-2202-4802-a567-1bc2b063e671/manufacturing/20cbce03-cb5d-4b34-9258-abf8999b6629)
-   All mutations will require logic to convert between the XQL objects into the REST APIs's DTOs.
-   Almost innevitable that we will have duplicate logic.

```tsx
const UsersPage = () => {
    const page = useXql(queryKey:"usersPage",usersPageQuery)

    return <UserList users={page.users} />
}

function UserList({users}:{users:User[]}) {
    return <div>{users.map(u => <UserComponent user={u} />)}</div>
}

const UserComponent = ({user}:{user:User}) => {
    return <...>
}
```

# Deven's thoughts

-   Security of writing queries on the FE?
-   What happens if the schema changes?
-   Do you require BE and FE to use the same version of XQL

```ts
// on the BE
const user = from('users').select('id', 'name', 'email');

// on the FE
const user = from('users').select('id', 'name');
// this query should be allowed because the BE selects a wider column set.

// on the FE
const user = from('users').select('id', 'name', 'other_field');
// this query should be reject because the BE doesn't select 'other_field'
```

-   Caching makes it interesting
-   If it didn't need to talk to the BE
-   Win: the fact that you don't need to write simple query endpoints
-   What demo would you like to see?
    -   Perf beats current solution manager page.

# Andi's thoughts

-   Custom providers are really important because there's a lot of business logic in the data-fetching.
-   Security: SQL injection => it's possible.
-

```tsx
import { DB } from "./db"
import { QueryEngine, mapQuery } from "@synthql/backend";
import { orders } from "./queries";

interface ActivityConfig {
    id: string,
    name: string,
}

// virtual table
interface DriverStatus {
    activity_config_id:string
    value: number
    satus: "ok"|"warning"|"error"
}

interface DB {
    ...,
    // form an endpoint
    drivers: Driver
    //from the DB
    activity_config:ActivityConfig,
    // from the DB
    manufacturing_scenario: { activity_config_id: string }
}

// @luminovo/queries/activities-table-query.ts
const driverStatuses = from('driver_status')
    .column('status','value')
    .where({ activity_config_id: col('activity_config.id') })
    .lazy()
    .many();

const activityConfig = from('activity_config')
    .column('name','id')
    .where(...)
    .include({ driverStatuses })
    .many()

export query = from('manufacturing_scenario')
    .column('name')
    .where({id:someID})
    .include({ activityConfig })
    .many();

useSynthql(q)

const restrictOrdersByUser = provider<DB>()
    .from('activity_config')
    .execute((query, context) => {
        return http('POST /activity-config')
    })

const queryEngine = new QueryEngine<DB>({
    providers: [restrictOrdersByUser]
})

queryEngine.registerQueries(orders)
```

# Shamir's thoughts

-   Lazy is the killer feature.
-   Usability seems acceptable.
-   Organizational concern: interdependencies.
-   Fernando:
    -   Dataloading:
        -   1. Ops model
        -   2. "joining layer" usually in routes (30% complexity), non-optimal fetch tree, double fetching.
        -   3. Testing / iterating (routes)
-   Not all joins are performant:
-   Shamir:
    1. Testing / iterating: disagree,
    2. Ops model: not ideal: fetchihg too little / fetching too much
    3. Don't work enough on dataloading
-