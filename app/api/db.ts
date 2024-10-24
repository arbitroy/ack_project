import { Pool, QueryResult, QueryResultRow } from 'pg'
import { setTimeout } from 'timers/promises'

const MAX_RETRIES = 5
const INITIAL_BACKOFF = 1000 // 1 second

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})

type OperationFunction<T> = () => Promise<T>

async function executeWithRetry<T>(
    operation: OperationFunction<T>,
    retries = MAX_RETRIES,
    backoff = INITIAL_BACKOFF
): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        // Ensure error is properly typed
        const err = error as NodeJS.ErrnoException;
        if (retries > 0 && err?.code === 'ECONNRESET') {
            console.log(`Connection reset. Retrying in ${backoff}ms... (${retries} attempts left)`)
            await setTimeout(backoff)
            return executeWithRetry(operation, retries - 1, backoff * 2)
        }
        throw err
    }
}

async function queryWithRetry<T extends QueryResultRow = QueryResultRow>(
    query: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    return executeWithRetry(() => pool.query<T>(query, params))
}

export { queryWithRetry }
