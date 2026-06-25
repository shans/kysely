import { DefaultQueryExecutor } from './DefaultQueryExecutor.js'
import { QueryCreator } from '../../../../shared/query-creator.js'
import { createQueryId } from '../../../../shared/util/query-id.js'

export class IntrospectionWrapper<DB> {
  readonly #executor: DefaultQueryExecutor
  readonly #creator: QueryCreator<DB>

  constructor(executor: DefaultQueryExecutor, creator?: QueryCreator<DB>) {
    this.#executor = executor
    this.#creator = creator ?? new QueryCreator<DB>({})
  }

  selectFrom(from: any): any {
    return wrapIntrospectionBuilder(this.#creator.selectFrom(from), this.#executor)
  }

  with(name: any, expression: any): IntrospectionWrapper<any> {
    return new IntrospectionWrapper<any>(
      this.#executor,
      this.#creator.with(name, expression) as unknown as QueryCreator<any>,
    )
  }
}

function wrapIntrospectionBuilder(builder: any, executor: DefaultQueryExecutor): any {
  return new Proxy(builder, {
    get(target: any, prop: string | symbol) {
      if (prop === 'execute') {
        return async () => {
          const node = target.toOperationNode()
          const queryId = createQueryId()
          const compiled = executor.compileQuery(node, queryId)
          const result = await executor.executeQuery(compiled)
          return result.rows
        }
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return (...args: any[]) => {
          const result = value.apply(target, args)
          if (result != null && typeof result === 'object' && typeof result.toOperationNode === 'function') {
            return wrapIntrospectionBuilder(result, executor)
          }
          return result
        }
      }
      return value
    },
  })
}
