const { services } = require('../server/firebase');
const { json, body, edil, failure, problem } = require('../server/http');
const { userService } = require('../server/users');
module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') { res.setHeader('Allow', 'PATCH, DELETE, OPTIONS'); res.statusCode = 204; res.end(); return; }
    if (!['PATCH', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'PATCH, DELETE, OPTIONS'); throw problem('method-not-allowed', 'Metodo no permitido.', 405); }
    const deps = services(); const actor = await edil(req, deps); const input = await body(req);
    const service = userService(deps);
    const result = req.method === 'DELETE'
      ? await service.remove(input.uid, actor)
      : await service.update(input.uid, input.perfil, input.password, actor, input.action === 'recover');
    json(res, 200, result);
  } catch (error) { failure(res, error); }
};
