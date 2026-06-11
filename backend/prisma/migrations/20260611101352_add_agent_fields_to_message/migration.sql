-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "agentAction" TEXT,
ADD COLUMN     "agentIntent" TEXT,
ADD COLUMN     "agentMetadata" JSONB,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;
