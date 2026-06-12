-- Tope de gasto: contador de discos nuevos fabricados a los oyentes por día.
-- Al alcanzar DAILY_GENERATION_BUDGET, el pick del día usa el catálogo existente
-- en vez de generar uno nuevo (sin costo de IA). No afecta al admin ni al worker.
CREATE TABLE "GenerationBudget" (
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GenerationBudget_pkey" PRIMARY KEY ("date")
);
