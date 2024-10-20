import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { queryWithRetry } from '../../db'

export async function GET() {
    const cookieStore = cookies()
    const token = cookieStore.get('token')

    if (!token) {
        return NextResponse.json({ authenticated: false, error: 'No token found' }, { status: 401 })
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined')
        }

        const decoded = jwt.verify(token.value, process.env.JWT_SECRET) as { id: number, username: string, role: string }

        // Fetch the latest user data from the database
        const result = await queryWithRetry('SELECT Id, Username, Role FROM Users WHERE Id = $1', [decoded.id])

        if (result.rows.length === 0) {
            // User not found in the database
            return NextResponse.json({ authenticated: false, error: 'User not found in database' }, { status: 401 })
        }

        const user = result.rows[0]

        return NextResponse.json({
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        }, { status: 200 })
    } catch (error) {
        console.error('Authentication check error:', error)
        let errorMessage = 'Unknown error occurred'
        if (error instanceof jwt.JsonWebTokenError) {
            errorMessage = 'Invalid token'
        } else if (error instanceof jwt.TokenExpiredError) {
            errorMessage = 'Token expired'
        } else if (error instanceof Error) {
            errorMessage = error.message
        }
        return NextResponse.json({ authenticated: false, error: errorMessage }, { status: 401 })
    }
}