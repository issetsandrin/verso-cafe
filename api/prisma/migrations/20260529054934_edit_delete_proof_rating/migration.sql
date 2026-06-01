-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isCoffeeProof" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CoffeeRating" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoffeeRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoffeeRating_messageId_idx" ON "CoffeeRating"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CoffeeRating_messageId_userId_key" ON "CoffeeRating"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "CoffeeRating" ADD CONSTRAINT "CoffeeRating_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeRating" ADD CONSTRAINT "CoffeeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
