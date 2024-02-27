import { AnyDb, AnyQuery } from "../../../../types";
import { escapeRef } from "./escape";
import { RefOp } from "@synthql/queries";

export class TableRef {
    public readonly schema: string
    public readonly table: string

    constructor(schema: string, table: string) {
        this.schema = escapeRef(schema, false);
        this.table = escapeRef(table, false);
    }

    static parse(ref: string, defaultSchema: string): TableRef {
        const parts = ref.split(".")
        if (parts.length === 1) {
            return new TableRef(defaultSchema, parts[0])
        } else if (parts.length === 2) {
            return new TableRef(parts[0], parts[1])
        } else {
            throw new Error(`Invalid table reference ${ref}`)
        }
    }

    static fromQuery(defaultSchema: string, query: AnyQuery) {
        return this.parse(query.from, defaultSchema)
    }

    column(column: string): ColumnRef {
        return new ColumnRef(this, column)
    }

    /**
     * Returns the table reference in the form of schema.table, without quotes.
     * @returns Example: "public"."films"
     */
    canonical() {
        return `"${this.schema}"` + '.' + `"${this.table}"`
    }

    /**
     * Returns the table reference in the form of schema::table, without quotes.
     * @see aliasQuoted for a quoted version
     * @returns Example: public::films
     */
    alias() {
        return this.schema + '::' + this.table
    }

    /**
     * @returns Example: "public::table"
     */
    aliasQuoted() {
        return `"${this.alias()}"`;
    }
}

export class ColumnRef {
    public readonly tableRef: TableRef
    public readonly column: string

    constructor(tableRef: TableRef, column: string) {
        this.tableRef = tableRef
        this.column = escapeRef(column, false)
    }

    /**
     * Example: "public::table".column
     */
    aliasQuoted() {
        return this.tableRef.aliasQuoted() + '.' + this.column
    }

    static fromRefOp(op: RefOp<AnyDb>, defaultSchema: string): ColumnRef {
        const table = TableRef.parse(op.$ref.table, defaultSchema);
        return table.column(op.$ref.column);
    }
}