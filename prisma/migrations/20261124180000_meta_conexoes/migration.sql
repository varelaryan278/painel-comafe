-- AlterTable
ALTER TABLE "meta_contas" ADD COLUMN     "conexaoId" INTEGER;

-- CreateTable
CREATE TABLE "meta_conexoes" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "fbUserId" TEXT NOT NULL,
    "fbNome" TEXT NOT NULL,
    "tokenCifrado" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3),
    "invalida" BOOLEAN NOT NULL DEFAULT false,
    "contasDisponiveis" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_conexoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_conexoes_userId_fbUserId_key" ON "meta_conexoes"("userId", "fbUserId");
