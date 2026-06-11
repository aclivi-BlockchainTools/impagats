-- Translate existing status values to Catalan
UPDATE "ReturnedReceipt" SET "status" = 'DETECTAT' WHERE "status" = 'DETECTED';
UPDATE "ReturnedReceipt" SET "status" = 'EMPARELLAT' WHERE "status" = 'MATCHED';
UPDATE "ReturnedReceipt" SET "status" = 'REVISAR' WHERE "status" = 'NEEDS_REVIEW';
UPDATE "ReturnedReceipt" SET "status" = 'NOTIFICAT' WHERE "status" = 'NOTIFIED';
UPDATE "ReturnedReceipt" SET "status" = 'JUSTIFICANT_REBUT' WHERE "status" = 'PROOF_RECEIVED';
UPDATE "ReturnedReceipt" SET "status" = 'PAGAMENT_CONFIRMAT' WHERE "status" = 'PAYMENT_CONFIRMED';
UPDATE "ReturnedReceipt" SET "status" = 'TANCAT' WHERE "status" = 'CLOSED';
UPDATE "ReturnedReceipt" SET "status" = 'IGNORAT' WHERE "status" = 'IGNORED';

-- AlterTable
ALTER TABLE "ReturnedReceipt" ALTER COLUMN "status" SET DEFAULT 'DETECTAT';
