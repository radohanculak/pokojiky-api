/*
  Warnings:

  - Added the required column `availableTo` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "availableFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "availableTo" TIMESTAMP(3) NOT NULL;
