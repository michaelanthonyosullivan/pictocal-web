import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)

    // For migration testing, allow default user if no session? 
    // Step 2 says "Protect API routes". So strictly enforcing.
    // However, if the user hasn't logged in, they can't load data.
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerEmail = session.user.email;

    try {
        const entries = await prisma.diaryEntry.findMany({
            where: {
                ownerEmail: ownerEmail
            }
        });

        const db: Record<string, string> = {};
        const customImages: Record<number, string> = {};

        entries.forEach((entry: any) => {
            const y = entry.entryDate.getFullYear();
            const m = (entry.entryDate.getMonth() + 1).toString().padStart(2, '0');
            const d = entry.entryDate.getDate().toString().padStart(2, '0');
            const key = `${y}-${m}-${d}`;

            if (entry.content) {
                db[key] = entry.content;
            }

            // Construct customImages from entries on Day 1 that have an image URL
            if (entry.imageUrl && entry.entryDate.getDate() === 1) {
                customImages[entry.entryDate.getMonth()] = entry.imageUrl;
            }
        });

        return NextResponse.json({ db, customImages });
    } catch (error) {
        console.error('Load error:', error);
        return NextResponse.json({ success: false, message: 'Failed to load data from database' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerEmail = session.user.email;

    try {
        const body = await request.json();
        const { db, customImages } = body;

        const promises = [];

        if (db) {
            promises.push(...Object.entries(db).map(async ([dateKey, content]) => {
                const [y, m, d] = dateKey.split('-').map(Number);
                const entryDate = new Date(y, m - 1, d);

                const existing = await prisma.diaryEntry.findFirst({
                    where: { ownerEmail, entryDate }
                });

                if (existing) {
                    return prisma.diaryEntry.update({
                        where: { id: existing.id },
                        data: { content: String(content) }
                    });
                } else {
                    return prisma.diaryEntry.create({
                        data: {
                            ownerEmail,
                            entryDate,
                            content: String(content)
                        }
                    });
                }
            }));
        }

        if (customImages) {
            const currentYear = new Date().getFullYear();
            promises.push(...Object.entries(customImages).map(async ([monthIdx, url]) => {
                const m = parseInt(monthIdx);
                const entryDate = new Date(currentYear, m, 1);

                const existing = await prisma.diaryEntry.findFirst({
                    where: { ownerEmail, entryDate }
                });

                if (existing) {
                    return prisma.diaryEntry.update({
                        where: { id: existing.id },
                        data: { imageUrl: String(url) }
                    });
                } else {
                    return prisma.diaryEntry.create({
                        data: {
                            ownerEmail,
                            entryDate,
                            content: "",
                            imageUrl: String(url)
                        }
                    });
                }
            }));
        }

        await Promise.all(promises);

        return NextResponse.json({ success: true, message: 'Data saved to database' });
    } catch (error) {
        console.error('Save error:', error);
        return NextResponse.json({ success: false, message: 'Failed to save data to database' }, { status: 500 });
    }
}
