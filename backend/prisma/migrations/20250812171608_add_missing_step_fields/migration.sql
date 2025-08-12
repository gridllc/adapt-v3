-- AlterTable
ALTER TABLE "public"."ai_interactions" ADD COLUMN     "sourceModel" TEXT,
ADD COLUMN     "usedMemory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."question_vectors" ADD COLUMN     "modelName" TEXT DEFAULT 'openai-embedding-3-small';

-- AlterTable
ALTER TABLE "public"."questions" ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "reuseCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."steps" ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "confusionScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "questions_reuseCount_idx" ON "public"."questions"("reuseCount");
