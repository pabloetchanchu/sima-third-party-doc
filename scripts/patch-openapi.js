#!/usr/bin/env node
/**
 * Post-processes openapi.yaml generated from Postman:
 * - Fixes servers (QA + Production)
 * - Updates info metadata
 * - Adds securitySchemes for Mintlify playground
 */

const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, '..', 'openapi.yaml');
let yaml = fs.readFileSync(specPath, 'utf8');

yaml = yaml.replace(
  /^info:[\s\S]*?^servers:[\s\S]*?(?=^tags:)/m,
  `info:
  title: SIMA Third-Party API
  description: >-
    Referencia completa de la API de Terceros de SIMA. Generada automáticamente
    desde la colección de Postman. Para guías de integración, visitá docs.tp.sima.ag.
  version: 1.0.0
servers:
  - url: https://api.qa.sima.ag
    description: Entorno de pruebas (QA)
  - url: https://api.sima.ag
    description: Producción
`
);

if (!/^components:\s*$/m.test(yaml)) {
  yaml += `
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: access_token obtenido via POST /api/v2/login
    systemId:
      type: apiKey
      in: header
      name: X-SIMA-SYSTEM-ID
      description: Identificador del sistema integrador (8 para Third-Party API)
security:
  - bearerAuth: []
    systemId: []
`;
}

fs.writeFileSync(specPath, yaml);
console.log('openapi.yaml patched successfully');
