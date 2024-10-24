import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { queryWithRetry } from '../../db'

export async function POST(request: Request) {
    const { username, password, role } = await request.json()

    // Validate input
    if (!username || !password || !role) {
        return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    if (!['manager', 'planned_employee', 'actual_employee'].includes(role)) {
        return NextResponse.json({ success: false, message: 'Invalid role' }, { status: 400 })
    }

    try {
        const userCheck = await queryWithRetry('SELECT * FROM Users WHERE Username = $1', [username])
        if (userCheck.rows.length > 0) {
            return NextResponse.json({ success: false, message: 'Username already exists' }, { status: 409 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const result = await queryWithRetry(
            'INSERT INTO Users (Username, password_hash, Role) VALUES ($1, $2, $3) RETURNING ID, Username, Role',
            [username, hashedPassword, role]
        );

        const newUser = result.rows[0]

        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, role: newUser.role },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        )

        const response = NextResponse.json({
            success: true,
            user: { id: newUser.id, username: newUser.username, role: newUser.role }
        }, { status: 201 })

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600,
            path: '/',
        })

        return response

    } catch (error) {
        console.error('Detailed registration error:', error)
        return NextResponse.json({ success: false, message: 'An unexpected error occurred', error: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}