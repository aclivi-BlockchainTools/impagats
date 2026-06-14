-- CreateTable
CREATE TABLE "AgentLearningSuggestion" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER,
    "clientId" INTEGER,
    "receiptId" INTEGER,
    "originalTextHash" TEXT,
    "anonymizedText" TEXT,
    "analysisType" TEXT NOT NULL DEFAULT 'message_classification',
    "currentIntent" TEXT,
    "suggestedIntent" TEXT,
    "confidence" DOUBLE PRECISION,
    "suggestedReply" TEXT,
    "suggestedKeywords" JSONB,
    "suggestedStateChange" TEXT,
    "conversationQuality" TEXT,
    "agentEffectiveness" DOUBLE PRECISION,
    "issues" JSONB,
    "suggestedImprovements" JSONB,
    "risk" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AgentLearningSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKeywordRule" (
    "id" SERIAL NOT NULL,
    "intent" TEXT,
    "pattern" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'KEYWORD',
    "language" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKeywordRule_pkey" PRIMARY KEY ("id")
);
