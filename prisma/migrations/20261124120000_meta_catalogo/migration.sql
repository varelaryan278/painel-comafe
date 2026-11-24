-- CreateTable
CREATE TABLE "meta_contas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "anunciante" TEXT NOT NULL,
    "moeda" TEXT,
    "status" INTEGER,
    "ultimaSync" TIMESTAMP(3),
    "erro" TEXT,

    CONSTRAINT "meta_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_campanhas" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "objetivo" TEXT,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "criadoEm" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_conjuntos" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_conjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_anuncios" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "conjuntoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "criadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3),
    "criativoId" TEXT,
    "thumbnail" TEXT,
    "imagem" TEXT,
    "videoId" TEXT,
    "titulo" TEXT,
    "texto" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_anuncios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_gastos" (
    "adId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "gasto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meta_gastos_pkey" PRIMARY KEY ("adId","data")
);

-- CreateIndex
CREATE INDEX "meta_campanhas_contaId_idx" ON "meta_campanhas"("contaId");

-- CreateIndex
CREATE INDEX "meta_conjuntos_campanhaId_idx" ON "meta_conjuntos"("campanhaId");

-- CreateIndex
CREATE INDEX "meta_anuncios_contaId_idx" ON "meta_anuncios"("contaId");

-- CreateIndex
CREATE INDEX "meta_anuncios_campanhaId_idx" ON "meta_anuncios"("campanhaId");

-- CreateIndex
CREATE INDEX "meta_anuncios_conjuntoId_idx" ON "meta_anuncios"("conjuntoId");

-- CreateIndex
CREATE INDEX "meta_gastos_data_idx" ON "meta_gastos"("data");
