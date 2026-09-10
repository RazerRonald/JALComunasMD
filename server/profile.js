const { problem } = require('./http');
function profile(input = {}, uid, publicRequest = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem('invalid-profile', 'Revisa los datos del formulario.', 400);
  const clean = (key) => String(input[key] || '').trim().replace(/\s+/g, ' ');
  const result = { uid, email: clean('email').toLowerCase(), nombre: clean('nombre'),
    primer_apellido: clean('primer_apellido'), segundo_apellido: clean('segundo_apellido'),
    tipo_documento: clean('tipo_documento').toUpperCase(), numero_documento: clean('numero_documento').replace(/\s/g, ''),
    ciudad_documento: clean('ciudad_documento'), rol: publicRequest ? 'estudiante' : input.rol };
  if (Object.entries(result).some(([key, value]) => key !== 'uid' && !value)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || result.email.length > 180
    || ['nombre', 'primer_apellido', 'segundo_apellido', 'ciudad_documento'].some(key => result[key].length > 80)
    || !['CC', 'CE', 'PPT', 'PA'].includes(result.tipo_documento)
    || result.numero_documento.length < (publicRequest ? 6 : 4) || result.numero_documento.length > 30
    || !['edil', 'estudiante'].includes(result.rol)) throw problem('invalid-profile', 'Revisa los datos del formulario.', 400);
  return result;
}
const fullName = p => [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
module.exports = { profile, fullName };
