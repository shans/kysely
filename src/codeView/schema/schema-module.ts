import { AlterTableNode } from '../../shared/operation-node/alter-table-node.js'
import { CreateIndexNode } from '../../shared/operation-node/create-index-node.js'
import { CreateSchemaNode } from '../../shared/operation-node/create-schema-node.js'
import { CreateTableNode } from '../../shared/operation-node/create-table-node.js'
import { DropIndexNode } from '../../shared/operation-node/drop-index-node.js'
import { DropSchemaNode } from '../../shared/operation-node/drop-schema-node.js'
import { DropTableNode } from '../../shared/operation-node/drop-table-node.js'
import { parseTable } from '../../shared/parser/table-parser.js'
import { AlterTableBuilder } from './alter-table-builder.js'
import { CreateIndexBuilder } from './create-index-builder.js'
import { CreateSchemaBuilder } from './create-schema-builder.js'
import { CreateTableBuilder } from './create-table-builder.js'
import { DropIndexBuilder } from './drop-index-builder.js'
import { DropSchemaBuilder } from './drop-schema-builder.js'
import { DropTableBuilder } from './drop-table-builder.js'
import { CreateViewBuilder } from './create-view-builder.js'
import { CreateViewNode } from '../../shared/operation-node/create-view-node.js'
import { DropViewBuilder } from './drop-view-builder.js'
import { DropViewNode } from '../../shared/operation-node/drop-view-node.js'
import { CreateTypeBuilder } from './create-type-builder.js'
import { DropTypeBuilder } from './drop-type-builder.js'
import { CreateTypeNode } from '../../shared/operation-node/create-type-node.js'
import { DropTypeNode } from '../../shared/operation-node/drop-type-node.js'
import {
  parseSchemableIdentifier,
  parseSchemableIdentifierArray,
} from '../../shared/parser/identifier-parser.js'
import { RefreshMaterializedViewBuilder } from './refresh-materialized-view-builder.js'
import { RefreshMaterializedViewNode } from '../../shared/operation-node/refresh-materialized-view-node.js'
import { AlterTypeBuilder } from './alter-type-builder.js'
import { AlterTypeNode } from '../../shared/operation-node/alter-type-node.js'

export class SchemaModule {
  createTable<TB extends string>(table: TB): CreateTableBuilder<TB, never> {
    return new CreateTableBuilder({
      node: CreateTableNode.create(parseTable(table)),
    })
  }

  dropTable(table: string): DropTableBuilder {
    return new DropTableBuilder({
      node: DropTableNode.create(parseTable(table)),
    })
  }

  createIndex(indexName: string): CreateIndexBuilder {
    return new CreateIndexBuilder({
      node: CreateIndexNode.create(indexName),
    })
  }

  dropIndex(indexName: string): DropIndexBuilder {
    return new DropIndexBuilder({
      node: DropIndexNode.create(indexName),
    })
  }

  createSchema(schema: string): CreateSchemaBuilder {
    return new CreateSchemaBuilder({
      node: CreateSchemaNode.create(schema),
    })
  }

  dropSchema(schema: string): DropSchemaBuilder {
    return new DropSchemaBuilder({
      node: DropSchemaNode.create(schema),
    })
  }

  alterTable(table: string): AlterTableBuilder {
    return new AlterTableBuilder({
      node: AlterTableNode.create(parseTable(table)),
    })
  }

  createView(viewName: string): CreateViewBuilder {
    return new CreateViewBuilder({
      node: CreateViewNode.create(viewName),
    })
  }

  refreshMaterializedView(viewName: string): RefreshMaterializedViewBuilder {
    return new RefreshMaterializedViewBuilder({
      node: RefreshMaterializedViewNode.create(viewName),
    })
  }

  dropView(viewName: string): DropViewBuilder {
    return new DropViewBuilder({
      node: DropViewNode.create(viewName),
    })
  }

  createType(typeName: string): CreateTypeBuilder {
    return new CreateTypeBuilder({
      node: CreateTypeNode.create(parseSchemableIdentifier(typeName)),
    })
  }

  alterType<const N extends string>(name: N): AlterTypeBuilder<N> {
    return new AlterTypeBuilder({
      node: AlterTypeNode.create(parseSchemableIdentifier(name)),
    })
  }

  dropType(typeName: string | string[]): DropTypeBuilder {
    return new DropTypeBuilder({
      node: DropTypeNode.create(parseSchemableIdentifierArray(typeName)),
    })
  }

  // Type-compatible stubs: plugin routing is handled by the API-layer Proxy
  // (wrapModule intercepts withPlugin and applies it to the execution context).
  withPlugin(_plugin: unknown): this { return this }
  withoutPlugins(): this { return this }
  withSchema(_schema: string): this { return this }
}
