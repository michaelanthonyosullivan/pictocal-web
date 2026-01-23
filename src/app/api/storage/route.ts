import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from '@/lib/prisma';
import { del } from '@vercel/blob';

// ==========================================
// 1. GET: LOAD DATA WHEN LOGGING IN
// ==========================================
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch all diary entries for the logged-in user
        const entries = await prisma.diaryEntry.findMany({
            where: { ownerEmail: session.user.email },
        });

        // Reconstruct the data into the exact format the frontend needs
        const db: Record<string, string> = {};
        const customImages: Record<number, string> = {};

        entries.forEach(entry => {
            // Create YYYY-MM-DD key for the text
            const dateKey = entry.entryDate.toISOString().split('T')[0];
            if (entry.content) {
                db[dateKey] = entry.content;
            }

            // Group images by their month (0 = Jan, 11 = Dec)
            if (entry.imageUrl) {
                const monthIndex = entry.entryDate.getMonth();
                customImages[monthIndex] = entry.imageUrl;
            }
        });

        // Send the data back to the browser!
        return NextResponse.json({ db, customImages });

    } catch (error) {
        console.error('Database Load Error:', error);
        return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 });
    }
}


// ==========================================
// 2. POST: SAVE DATA WHEN CLICKING 'SAVE'
// ==========================================
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const dateString = body.entryDate || body.date;

        if (!dateString) {
            return NextResponse.json({ error: 'Missing date' }, { status: 400 });
        }

        const entryDate = new Date(dateString);
        const ownerEmail = session.user.email;
        const { content, imageUrl } = body;

        // Find existing entry
        const existingEntry = await prisma.diaryEntry.findFirst({
            where: { ownerEmail, entryDate },
        });

        // Delete old image if a new one is replacing it
        if (imageUrl && existingEntry?.imageUrl && existingEntry.imageUrl !== imageUrl) {
            try {
                await del(existingEntry.imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
            } catch (e) {
                console.warn("Could not delete old image:", e);
            }
        }

        // Save to Database
        const finalContent = content !== undefined ? content : existingEntry?.content || "";
        const finalImageUrl = imageUrl !== undefined ? imageUrl : existingEntry?.imageUrl;

        let updatedEntry;

        if (existingEntry) {
            updatedEntry = await prisma.diaryEntry.update({
                where: { id: existingEntry.id },
                data: { content: finalContent, imageUrl: finalImageUrl },
            });
        } else {
            updatedEntry = await prisma.diaryEntry.create({
                data: { ownerEmail, entryDate, content: finalContent, imageUrl: finalImageUrl },
            });
        }

        return NextResponse.json(updatedEntry);

    } catch (error) {
        console.error('Database Save Error:', error);
        return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
    }
}