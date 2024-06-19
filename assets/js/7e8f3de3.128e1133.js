"use strict";(self.webpackChunk_synthql_docs=self.webpackChunk_synthql_docs||[]).push([[498],{4142:e=>{e.exports=JSON.parse('{"blogPosts":[{"id":"why-json-schema","metadata":{"permalink":"/SynthQL/blog/why-json-schema","editUrl":"https://github.com/synthql/SynthQL/tree/master/packages/docs/blog/2024-05-10-why-json-schema/index.md","source":"@site/blog/2024-05-10-why-json-schema/index.md","title":"Why JSON Schema?","description":"I wanted to drop a few words on why we\'re chosing JSON schema as an intermediate representation for our schemas. Putting it in writing will make it clearer, so here goes.","date":"2024-05-10T00:00:00.000Z","formattedDate":"May 10, 2024","tags":[{"label":"devlog","permalink":"/SynthQL/blog/tags/devlog"}],"readingTime":2.655,"hasTruncateMarker":false,"authors":[{"name":"Fernando Hurtado","title":"SynthQL maintainer","url":"https://github.com/fhur","imageURL":"https://gravatar.com/fernandohur","key":"fhur"}],"frontMatter":{"slug":"why-json-schema","title":"Why JSON Schema?","authors":["fhur"],"tags":["devlog"]},"unlisted":false},"content":"I wanted to drop a few words on why we\'re chosing `JSON schema` as an intermediate representation for our schemas. Putting it in writing will make it clearer, so here goes.\\n\\n## The goal: Static & Runtime information about your schema\\n\\nLet\'s start by asking ourselves what is the goal: the goal is to have schema information available to the query builder so you can build queries safely (no typos) and with great DX (auto completion).\\n\\nTo achieve this, the query builder needs to know the shape of your DB schema and convert it to something that the TypeScript compiler can understand.\\n\\nSo we know that the query builder needs static type information. What\'s new is that the query builder also needs information at runtime about your schema. Let\'s look at a few examples that we want to support:\\n\\n### Sub goal: select all fields\\n\\nLet\'s look at a very basic example. Find an actor by ID.\\n\\n```ts\\nfrom(\'actors\').where({ id: 1 }).maybe();\\n```\\n\\nWe expect this to compile to something like\\n\\n```sql\\nselect actor_id, name, ...\\nfrom actors\\nwhere id = $1\\n```\\n\\nNotice that I didn\'t write `select *`. That\'s intentional, because we can only select \\"selectable\\" fields. So the query builder needs to let the columns \\"default\\" to something like `Object.keys(db.actors.columns)`. This is hint #1 that we need the schema available at runtime.\\n\\n### Sub goal: infer the groupingId\\n\\n```ts\\nfrom(\'actor\')\\n  .where({id})\\n  .include({ films })\\n  .maybe()\\n  .groupingId(\'actor_id\') # <======= WHY DO I HAVE TO DO THIS?\\n```\\n\\nAs you\'ve already experienced the grouping ID is an annoyance. In most cases we can simply infer it: it\'s the primary key of the table. To actually infer it we need to have at runtime, type information available to the query builder so that the query builder can do something like\\n\\n```ts\\nconst groupingId = db.actor.primaryKey;\\n```\\n\\nBoth of these sub-goals imply that in the near future the query builder will be passed not just the DB static type, but also some kind of runtime information about your schema.\\n\\n```ts\\n// old version: only has static type information available\\nconst from = query<DB>().from;\\n\\n// new version: has both static and runtime type information available\\nconst from = query<DB>(db).from;\\n```\\n\\n# So... why JSON schema?\\n\\nOk, now that we\'ve talked about some of the goals we want to support: let\'s go back to the original question. Why is JSON schema a good choice?\\n\\n1. There is great tooling support for JSON schema: We can find libraries that generate zod from JSON schema or generate TypeScript types from json schema.\\n1. Building a JSON schema programmatically is really easy. Converting from `pg-extract-schema` to JSON schema is trivial, and very easy to unit test.\\n1. JSON schema itself is available at runtime: As JSON schema is just a plain old javascript object, it\'s available at runtime, and so we can pass it to the query builer as input so it can use it to infer the groupingId and select all the fields.\\n1. Runtime type checking: In the future we will want to add something like zod to the `QueryEngine` so that it blocks malformed queries. Using JSON Schema we can get zod for free."}]}')}}]);