/**
 * Normaliza un texto para comparar palabras clave sin depender de
 * mayúsculas, tildes, signos de puntuación ni espacios repetidos.
 *
 *   normalizarTexto('  ¡No hay  WiFi!  ') === 'no hay wifi'
 *   normalizarTexto('Contraseña')         === 'contrasena'
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes y diéresis (á→a, ñ→n, ü→u)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // signos y puntuación cuentan como separadores
    .trim();
}

/**
 * Indica si `frase` aparece en `texto` como palabra o frase completa.
 * Ambos valores deben venir ya normalizados con `normalizarTexto`.
 *
 *   contieneFraseCompleta('mi teclado falla', 'teclado')  === true
 *   contieneFraseCompleta('tecladoinalambrico', 'teclado') === false
 */
export function contieneFraseCompleta(textoNormalizado: string, fraseNormalizada: string): boolean {
  if (!fraseNormalizada) return false;
  return ` ${textoNormalizado} `.includes(` ${fraseNormalizada} `);
}
