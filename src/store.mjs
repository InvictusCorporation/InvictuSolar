import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog(id TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id), body TEXT NOT NULL, PRIMARY KEY(tenant_id,id));
    CREATE TABLE IF NOT EXISTS proposals(id TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id), body TEXT NOT NULL, PRIMARY KEY(tenant_id,id));
    CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, proposal_id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(tenant_id,proposal_id,revision), FOREIGN KEY(tenant_id,proposal_id) REFERENCES proposals(tenant_id,id));
    CREATE TABLE IF NOT EXISTS version_parameters(version_id TEXT PRIMARY KEY REFERENCES versions(id), tenant_id TEXT NOT NULL REFERENCES tenants(id), body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS versions_immutable_update BEFORE UPDATE ON versions BEGIN SELECT RAISE(ABORT,'Versão imutável'); END;
    CREATE TRIGGER IF NOT EXISTS versions_immutable_delete BEFORE DELETE ON versions BEGIN SELECT RAISE(ABORT,'Versão imutável'); END;
    CREATE TRIGGER IF NOT EXISTS parameters_immutable_update BEFORE UPDATE ON version_parameters BEGIN SELECT RAISE(ABORT,'Parâmetros imutáveis'); END;
    CREATE TRIGGER IF NOT EXISTS parameters_immutable_delete BEFORE DELETE ON version_parameters BEGIN SELECT RAISE(ABORT,'Parâmetros imutáveis'); END;
    CREATE TABLE IF NOT EXISTS documents(version_id TEXT PRIMARY KEY REFERENCES versions(id), tenant_id TEXT NOT NULL REFERENCES tenants(id), html TEXT NOT NULL, digest TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS share_links(id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), version_id TEXT NOT NULL REFERENCES versions(id), token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reading_events(id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), version_id TEXT NOT NULL REFERENCES versions(id), link_id TEXT NOT NULL REFERENCES share_links(id), name TEXT NOT NULL, identification TEXT NOT NULL, method TEXT NOT NULL, version_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS documents_immutable_update BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'Documento imutável'); END;
    CREATE TRIGGER IF NOT EXISTS documents_immutable_delete BEFORE DELETE ON documents BEGIN SELECT RAISE(ABORT,'Documento imutável'); END;
    CREATE TRIGGER IF NOT EXISTS reading_immutable_update BEFORE UPDATE ON reading_events BEGIN SELECT RAISE(ABORT,'Evento imutável'); END;
    CREATE TRIGGER IF NOT EXISTS reading_immutable_delete BEFORE DELETE ON reading_events BEGIN SELECT RAISE(ABORT,'Evento imutável'); END;
    PRAGMA user_version=2;`);
  if (!db.prepare('SELECT id FROM tenants LIMIT 1').get()) seed(db);
  const jsonGet = (table, tenant, id) => { const r = db.prepare(`SELECT body FROM ${table} WHERE tenant_id=? AND id=?`).get(tenant, id); return r ? JSON.parse(r.body) : null; };
  return {
    db,
    transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const v = fn(); db.exec('COMMIT'); return v; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    tenants: () => db.prepare('SELECT id,body FROM tenants').all().map(r => ({ id: r.id, ...JSON.parse(r.body) })),
    company: id => { const r = db.prepare('SELECT body FROM tenants WHERE id=?').get(id); return r ? JSON.parse(r.body) : null; },
    setCompany: (id, body) => db.prepare('UPDATE tenants SET body=? WHERE id=?').run(JSON.stringify(body), id),
    catalog: tenant => db.prepare('SELECT id,body FROM catalog WHERE tenant_id=? ORDER BY rowid').all(tenant).map(r => ({ id: r.id, ...JSON.parse(r.body) })),
    saveItem: (tenant, id, body) => db.prepare('INSERT INTO catalog(id,tenant_id,body) VALUES(?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET body=excluded.body').run(id, tenant, JSON.stringify(body)),
    item: (tenant, id) => jsonGet('catalog', tenant, id),
    proposals: tenant => db.prepare('SELECT body FROM proposals WHERE tenant_id=? ORDER BY rowid DESC').all(tenant).map(r => JSON.parse(r.body)),
    proposal: (tenant, id) => jsonGet('proposals', tenant, id),
    saveProposal: (tenant, id, body) => db.prepare('INSERT INTO proposals(id,tenant_id,body) VALUES(?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET body=excluded.body').run(id, tenant, JSON.stringify(body)),
    version: (tenant, id) => { const r = db.prepare('SELECT * FROM versions WHERE tenant_id=? AND id=?').get(tenant, id); return r ? { ...JSON.parse(r.body), hash: r.hash } : null; },
    versions: (tenant, proposal) => db.prepare('SELECT id,revision,hash,created_at FROM versions WHERE tenant_id=? AND proposal_id=? ORDER BY revision DESC').all(tenant, proposal),
    saveVersion: (tenant, proposal, version, body, hash) => db.prepare('INSERT INTO versions(id,tenant_id,proposal_id,revision,body,hash,created_at) VALUES(?,?,?,?,?,?,?)').run(version, tenant, proposal, body.revision, JSON.stringify(body), hash, body.createdAt),
    saveParameters: (tenant, version, body) => db.prepare('INSERT INTO version_parameters VALUES(?,?,?)').run(version, tenant, JSON.stringify(body)),
    saveDocument: (tenant, version, html, digest) => db.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(version,tenant,html,digest),
    document: (tenant, version) => db.prepare('SELECT html,digest FROM documents WHERE tenant_id=? AND version_id=?').get(tenant,version),
    createLink: (id,tenant,version,tokenHash,expires) => db.prepare('INSERT INTO share_links(id,tenant_id,version_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)').run(id,tenant,version,tokenHash,expires,new Date().toISOString()),
    resolveLink: tokenHash => db.prepare('SELECT * FROM share_links WHERE token_hash=? AND revoked=0 AND expires_at>?').get(tokenHash,new Date().toISOString()),
    links: (tenant,version) => db.prepare('SELECT id,expires_at,revoked,created_at FROM share_links WHERE tenant_id=? AND version_id=? ORDER BY created_at DESC').all(tenant,version),
    revokeLink: (tenant,id) => db.prepare('UPDATE share_links SET revoked=1 WHERE tenant_id=? AND id=?').run(tenant,id),
    reading: (tenant,version,link,name,identification,hash) => db.prepare('INSERT INTO reading_events VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),tenant,version,link,name,identification,'demo:self-declared-reading',hash,new Date().toISOString()),
    readings: (tenant,version) => db.prepare('SELECT name,identification,method,version_hash,created_at FROM reading_events WHERE tenant_id=? AND version_id=? ORDER BY created_at DESC').all(tenant,version),
    audit: (tenant, role, action, entity) => db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(), tenant, `demo:${role}`, action, entity, new Date().toISOString()),
    auditList: tenant => db.prepare('SELECT actor,action,entity_id,created_at FROM audit WHERE tenant_id=? ORDER BY rowid DESC LIMIT 30').all(tenant),
    close: () => db.close(),
  };
}

function seed(db) {
  for (const [id, name, color, cost, losses] of [['demo-a', 'Aurora Solar · Demo', '#146b52', 42000, 20], ['demo-b', 'Horizonte Energia · Demo', '#315c99', 47000, 18]]) {
    db.prepare('INSERT INTO tenants VALUES(?,?)').run(id, JSON.stringify({ name, color, presentation: 'Soluções fotovoltaicas para residências e empresas. Ambiente fictício para homologação do gerador de propostas.', terms: 'Valores ilustrativos. Projeto sujeito a vistoria e aprovação técnica. Garantias e condições definitivas serão cadastradas pela empresa.', lossesPct: losses, discountPct: 5, moduleArea: 2.8, deliveryDays: 45, validityDays: 15 }));
    const items = [
      { id: `${id}-panel`, name: 'Módulo fotovoltaico 620 Wp', brand: 'Equipamento de demonstração', kind: 'module', unit: 'un', watts: 620, costCents: cost, saleCents: 0, markupBps: 2500, mode: 'markup', quantityRule: 'module', baseQuantity: 1 },
      { id: `${id}-inverter`, name: 'Inversor 8 kW', brand: 'Equipamento de demonstração', kind: 'inverter', unit: 'un', watts: 8000, costCents: 430000, saleCents: 580000, markupBps: 0, mode: 'fixed', quantityRule: 'inverter', baseQuantity: 1 },
      { id: `${id}-structure`, name: 'Estrutura por módulo', brand: '', kind: 'structure', unit: 'un', watts: 0, costCents: 7500, saleCents: 11000, markupBps: 0, mode: 'fixed', quantityRule: 'module', baseQuantity: 1 },
      { id: `${id}-service`, name: 'Projeto e instalação · estimativa', brand: '', kind: 'service', unit: 'serviço', watts: 0, costCents: 150000, saleCents: 240000, markupBps: 0, mode: 'fixed', quantityRule: 'fixed', baseQuantity: 1 },
    ];
    for (const item of items) { const { id: itemId, ...body } = item; db.prepare('INSERT INTO catalog VALUES(?,?,?)').run(itemId, id, JSON.stringify({ ...body, active: true, validUntil: '' })); }
  }
}
