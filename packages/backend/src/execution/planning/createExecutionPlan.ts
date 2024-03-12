import { collectColumnReferences } from "../../query/collectColumnReferences";
import { mapQuery } from "../../query/mapQuery";
import { createRefContext } from "../../refs/RefContext";
import { AnyQuery } from "../../types";
import { ExecuteProps } from "../execute";
import { ExecPlanTree, PlanningQuery } from "../types";
import { assignExecutors } from "./assignExecutors";

export function createExecutionPlan(query: AnyQuery, props: ExecuteProps): ExecPlanTree {
    const { defaultSchema } = props;
    // Create an empty ref context.
    const refContext = createRefContext();
    const allColumns = collectColumnReferences(query, defaultSchema);

    // Collect all references in the query, but add no values as we don't have any yet.
    // Values will be added during the execution phase.
    for (const { column } of allColumns) {
        refContext.addValues(column);
    }

    const planningQuery = mapQuery<PlanningQuery>(query, (q, parent): PlanningQuery => {
        return {
            ...q,
            includeKey: parent?.includeKey,
            parentQuery: parent?.parentQuery,
            path: parent?.childPath ?? []
        }
    })

    const root = assignExecutors(planningQuery, allColumns.map(c => c.column), props)

    return {
        root,
        refContext
    }
}



