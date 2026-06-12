-- Puntaje del usuario: de la escala 1-5 a la nueva 1-10 (más amplia, para
-- poder puntuar mejor). Reescala las reseñas existentes (todas hoy en 1-5)
-- duplicando el valor (5→10, 4→8, …), preservando el sentido. Corre una sola
-- vez por base de datos, así que no hay riesgo de re-escalar lo ya convertido.
UPDATE "Review" SET "rating" = "rating" * 2 WHERE "rating" <= 5;
