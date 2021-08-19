/*
  Warnings:

  - You are about to drop the column `availableFrom` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `availableTo` on the `Room` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "availableFrom",
DROP COLUMN "availableTo";
