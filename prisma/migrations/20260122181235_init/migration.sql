-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);
