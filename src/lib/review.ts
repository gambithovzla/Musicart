// Claves especiales dentro de `answersJson` de una reseña, además de las
// respuestas a las preguntas de reflexión del dossier. Al guardarse como texto
// con etiqueta legible, alimentan también la memoria del curador (el motor de
// recomendación lee el diario tal cual). Mantenerlas aquí evita que el diario y
// el formulario se desincronicen.

export const RATING_MAX = 10;

export const COMMENT_KEY = "Lo que quiero recordar de este disco";
export const FAVORITE_KEY = "Mi canción favorita";

/** Reseña "no me gustó": cuarto inferior de la escala (≤ 4 sobre 10). El motor
 * de recomendación excluye estos discos de futuras sugerencias. */
export const DISLIKED_THRESHOLD = 4;

/** Reseña "loved it": mitad superior de la escala (≥ 8 sobre 10). */
export const LOVED_THRESHOLD = 8;

/** Etiqueta corta para un puntaje 1-10, para mostrar al usuario. */
export function ratingCaption(rating: number): string {
  if (rating <= 0) return "Tócalo para puntuar";
  if (rating <= 2) return "No fue para mí";
  if (rating <= 4) return "Regular";
  if (rating <= 6) return "Está bien";
  if (rating <= 8) return "Me gustó";
  return "Me encantó";
}

/** Separa el comentario libre y la canción favorita del resto de respuestas. */
export function splitAnswers(answers: Record<string, string>): {
  comment: string;
  favorite: string;
  reflections: Record<string, string>;
} {
  const { [COMMENT_KEY]: comment, [FAVORITE_KEY]: favorite, ...reflections } = answers;
  return {
    comment: comment ?? "",
    favorite: favorite ?? "",
    reflections,
  };
}
