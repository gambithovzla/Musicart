-- Impacto cultural: de la antigua escala 1-5 a la nueva escala 1-100.
-- Reescala los discos existentes (todos están hoy en 1-5) para que no se vean
-- como "5/100". El mapeo es suave (5→90, 4→72, 3→54, 2→36, 1→18); los discos
-- nuevos los calibra la IA directamente en 1-100. Esta migración corre una sola
-- vez por base de datos, así que no hay riesgo de re-escalar lo ya convertido.
UPDATE "Album" SET "impact" = LEAST("impact" * 18, 100) WHERE "impact" <= 5;

-- Nuevo valor por defecto acorde a la escala 1-100 (impacto medio).
ALTER TABLE "Album" ALTER COLUMN "impact" SET DEFAULT 50;
