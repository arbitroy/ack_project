import { authMiddleware } from '@/middleware/auth'
import { NextRequest, NextResponse } from 'next/server'
import { queryWithRetry } from '../db'

export async function GET(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const job = searchParams.get('job') || ''
    const table = searchParams.get('table') || ''
    const limit = 10
    const offset = (page - 1) * limit

    try {
        let countQuery = 'SELECT COUNT(*) FROM dailyreports dr JOIN jobs j ON dr.job_id = j.id JOIN tables t ON dr.table_id = t.id JOIN elements e ON dr.element_id = e.id'
        let dataQuery = `
            SELECT dr.id, dr.date, j.job_number, t.table_number, e.element_id,
                   e.planned_volume, e.planned_weight, dr.mep, dr.remarks, dr.status
            FROM dailyreports dr
            JOIN jobs j ON dr.job_id = j.id
            JOIN tables t ON dr.table_id = t.id
            JOIN elements e ON dr.element_id = e.id
        `
        const whereClause = []
        const queryParams = []

        if (search) {
            whereClause.push("(j.job_number ILIKE $1 OR t.table_number ILIKE $1 OR e.element_id ILIKE $1)")
            queryParams.push(`%${search}%`)
        }
        if (job) {
            whereClause.push("j.job_number = $" + (queryParams.length + 1))
            queryParams.push(job)
        }
        if (table) {
            whereClause.push("t.table_number = $" + (queryParams.length + 1))
            queryParams.push(table)
        }

        if (whereClause.length > 0) {
            const whereString = whereClause.join(' AND ')
            countQuery += ' WHERE ' + whereString
            dataQuery += ' WHERE ' + whereString
        }

        dataQuery += ' ORDER BY dr.date DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2)
        queryParams.push(limit, offset)

        const countResult = await queryWithRetry(countQuery, queryParams.slice(0, -2))
        const totalReports = parseInt(countResult.rows[0].count)
        const totalPages = Math.ceil(totalReports / limit)

        const result = await queryWithRetry(dataQuery, queryParams)

        return NextResponse.json({
            reports: result.rows,
            totalPages: totalPages,
            currentPage: page
        })
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    const { date, user_id, job_id, table_id, element_id, mep, remarks } = await request.json()

    try {
        const result = await queryWithRetry(
            'INSERT INTO dailyreports (date, user_id, job_id, table_id, element_id, mep, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [date, user_id, job_id, table_id, element_id, mep, remarks]
        )

        return NextResponse.json(result.rows[0], { status: 201 })
    } catch (error) {
        console.error('Error creating daily report:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    const { id, status } = await request.json()

    try {
        const result = await queryWithRetry(
            'UPDATE dailyreports SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        )

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Daily report not found' }, { status: 404 })
        }

        return NextResponse.json(result.rows[0])
    } catch (error) {
        console.error('Error updating daily report:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const authResponse = await authMiddleware(request)
    if (authResponse.status === 401) {
        return authResponse
    }

    const { id } = await request.json()

    try {
        const result = await queryWithRetry('DELETE FROM dailyreports WHERE id = $1 RETURNING *', [id])

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Daily report not found' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Daily report deleted successfully' })
    } catch (error) {
        console.error('Error deleting daily report:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}