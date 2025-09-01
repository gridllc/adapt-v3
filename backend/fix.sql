-- DropForeignKey
ALTER TABLE "public"."questions" DROP CONSTRAINT "questions_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."questions" DROP CONSTRAINT "questions_module_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."questions" DROP CONSTRAINT "questions_stepId_fkey";

-- DropForeignKey
ALTER TABLE "public"."questions" DROP CONSTRAINT "questions_userId_fkey";

-- DropIndex
DROP INDEX "public"."questions_reuseCount_idx";

-- AlterTable
ALTER TABLE "public"."questions" DROP COLUMN "createdAt",
DROP COLUMN "isFAQ",
DROP COLUMN "lastUsedAt",
DROP COLUMN "moduleId",
DROP COLUMN "reuseCount",
DROP COLUMN "stepId",
DROP COLUMN "userId",
DROP COLUMN "videoTime",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "reuse_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "step_id" TEXT,
ADD COLUMN     "user_id" TEXT,
ADD COLUMN     "video_time" DOUBLE PRECISION,
ALTER COLUMN "answer" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_questions_module_id" ON "public"."questions"("module_id");

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "fk_questions_module_id" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "fk_questions_module_id_named" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "fk_questions_step_id" FOREIGN KEY ("step_id") REFERENCES "public"."steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "fk_questions_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
