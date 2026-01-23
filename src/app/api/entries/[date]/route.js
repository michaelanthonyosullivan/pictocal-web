import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
	  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { date } = params;
	const absoluteDate = new Date(`${date}T00:00:00.000Z`);

	const entry = await prisma.diaryEntry.findUnique({
	  where: {
		ownerEmail_entryDate: {
		  ownerEmail: session.user.email,
		  entryDate: absoluteDate,
		},
	  },
	});

	return NextResponse.json(entry || null);
  } catch (error) {
	console.error("Error fetching entry:", error);
	return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
	  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { date } = params;
	const body = await request.json();
	
	const absoluteDate = new Date(`${date}T00:00:00.000Z`);

	const updatedEntry = await prisma.diaryEntry.upsert({
	  where: {
		ownerEmail_entryDate: {
		  ownerEmail: session.user.email,
		  entryDate: absoluteDate,
		},
	  },
	  update: {
		content: body.content,
		imageUrl: body.imageUrl || null,
	  },
	  create: {
		ownerEmail: session.user.email,
		entryDate: absoluteDate,
		content: body.content,
		imageUrl: body.imageUrl || null,
	  },
	});

	return NextResponse.json(updatedEntry);
  } catch (error) {
	console.error("Error saving entry:", error);
	return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}