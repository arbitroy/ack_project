import { NextResponse, NextRequest } from 'next/server'
import { authMiddleware } from '@/middleware/auth'
import { queryWithRetry } from '../db'



// GET all tables
export async function GET(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    try {
        const result = await queryWithRetry('SELECT * FROM Tables')
        return NextResponse.json(result.rows)
    } catch (error) {
        console.error('Error fetching tables:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// POST new table
export async function POST(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    try {
        const { table_number, description } = await request.json()
        const result = await queryWithRetry(
            'INSERT INTO Tables (table_number, Description) VALUES ($1, $2) RETURNING *',
            [table_number, description]
        )
        return NextResponse.json(result.rows[0], { status: 201 })
    } catch (error) {
        console.error('Error creating table:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// PUT (update) table
export async function PUT(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    try {
        const { table_number, description } = await request.json()
        const result = await queryWithRetry(
            'UPDATE Tables SET Description = $2 WHERE table_number = $1 RETURNING *',
            [table_number, description]
        )
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Table not found' }, { status: 404 })
        }
        return NextResponse.json(result.rows[0])
    } catch (error) {
        console.error('Error updating table:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE table
export async function DELETE(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    try {
        const { table_number } = await request.json()
        const result = await queryWithRetry('DELETE FROM Tables WHERE table_number = $1 RETURNING *', [table_number])
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Table not found' }, { status: 404 })
        }
        return NextResponse.json({ message: 'Table deleted successfully' })
    } catch (error) {
        console.error('Error deleting table:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}