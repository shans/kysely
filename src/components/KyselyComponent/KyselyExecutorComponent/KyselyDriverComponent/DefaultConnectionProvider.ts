import type { DatabaseConnection } from '../../../../types/driver/database-connection.js'
import type { ConnectionProvider } from '../../../../types/driver/connection-provider.js'
import type { Driver } from '../../../../shared/driver/driver.js'
import type { AbortableOperationOptions } from '../../../../shared/util/abort.js'

export class DefaultConnectionProvider implements ConnectionProvider {
  readonly #driver: Driver

  constructor(driver: Driver) {
    this.#driver = driver
  }

  async provideConnection<T>(
    consumer: (connection: DatabaseConnection) => Promise<T>,
    options?: AbortableOperationOptions,
  ): Promise<T> {
    const connection = await this.#driver.acquireConnection(options)

    try {
      return await consumer(connection)
    } finally {
      await this.#driver.releaseConnection(connection, options)
    }
  }
}
