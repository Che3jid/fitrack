import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const catalogSeed = JSON.parse(readFileSync(new URL('../src/data/food-catalog.json', import.meta.url), 'utf8'));

const COLLECTIONS = ['plans', 'weights', 'foods', 'trainings', 'days'];
const dated = /^\d{4}-\d{2}-\d{2}$/;
const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const label = (value) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 80;
const oneOf = (value, options) => options.includes(value);
const validDate = (value) => typeof value === 'string' && dated.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validProfile = (value) => value && oneOf(value.sex, ['male', 'female'])
  && Number.isInteger(value.ageYears) && bounded(value.ageYears, 18, 100)
  && bounded(value.heightCm, 100, 250) && bounded(value.weightKg, 30, 350)
  && oneOf(value.activityLevel, ['sedentary', 'light', 'moderate', 'high', 'veryHigh'])
  && oneOf(value.goal, ['lose', 'maintain', 'gain']);

function entity(value, owner, needsDate = true) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && value.id.length > 0
    && value.userId === owner && value.schemaVersion === 1
    && Number.isFinite(Date.parse(value.createdAt))
    && Number.isFinite(Date.parse(value.updatedAt))
    && (value.deletedAt === undefined || Number.isFinite(Date.parse(value.deletedAt)))
    && (!needsDate || (validDate(value.date) && value.date >= '1900-01-01'));
}

export function validateServerState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 2
    || value.recovery !== undefined || !COLLECTIONS.every((name) => Array.isArray(value[name]))) {
    throw new Error('数据格式或版本无效');
  }
  const owner = value.profile?.userId ?? null;
  if (value.profile !== null && (!entity(value.profile, owner, false) || !validProfile(value.profile))) throw new Error('个人资料无效');
  if (owner === null && COLLECTIONS.some((name) => value[name].length)) throw new Error('记录缺少个人资料');
  for (const name of COLLECTIONS) {
    const ids = new Set();
    const dates = new Set();
    if (value[name].length > 100_000) throw new Error('记录数量过多');
    for (const row of value[name]) {
      if (!entity(row, owner) || ids.has(row.id)) throw new Error(`${name} 记录无效`);
      if (name === 'plans' && (!validProfile(row.profileSnapshot) || row.calculationVersion !== 'mifflin-v1'
        || !['bmrKcal', 'tdeeKcal', 'targetKcal'].every((key) => bounded(row[key], 0.001, 100_000)))) throw new Error('目标快照无效');
      if (name === 'weights' && !bounded(row.weightKg, 30, 350)) throw new Error('体重记录无效');
      if (name === 'foods' && (!oneOf(row.mealType, ['breakfast', 'lunch', 'dinner', 'snack'])
        || !label(row.name) || !bounded(row.weightG, 0.1, 10_000)
        || !bounded(row.energyKcal, 0, 50_000)
        || !['proteinG', 'carbsG', 'fatG'].every((key) => bounded(row[key], 0, 10_000))
        || (row.sodiumMg !== undefined && !bounded(row.sodiumMg, 0, 100_000)))) throw new Error('饮食记录无效');
      if (name === 'trainings' && (!label(row.exerciseType) || !bounded(row.durationMin, 1, 1440)
        || !bounded(row.estimatedKcal, 0, 50_000) || row.estimateSource !== 'manual')) throw new Error('训练记录无效');
      if (name === 'days' && typeof row.dietCompleted !== 'boolean') throw new Error('完成状态无效');
      ids.add(row.id);
      if (['plans', 'weights', 'days'].includes(name)) {
        if (dates.has(row.date)) throw new Error(`${name} 日期重复`);
        dates.add(row.date);
      }
    }
  }
  return value;
}

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', 0);
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL UNIQUE, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS weights (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL UNIQUE, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS foods (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS trainings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS days (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL UNIQUE, row_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_foods (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, food_group TEXT NOT NULL, fdc_id INTEGER NOT NULL,
      energy_kcal REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL, sodium_mg REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS foods_date ON foods(date);
    CREATE INDEX IF NOT EXISTS trainings_date ON trainings(date);
    CREATE INDEX IF NOT EXISTS catalog_foods_group_name ON catalog_foods(food_group, name);
  `);
  const seedFood = db.prepare(`INSERT OR IGNORE INTO catalog_foods
    (id, name, food_group, fdc_id, energy_kcal, protein_g, carbs_g, fat_g, sodium_mg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const food of catalogSeed) {
      const nutrients = food.per100g;
      seedFood.run(food.id, food.name, food.group, food.fdcId, nutrients.energyKcal,
        nutrients.proteinG, nutrients.carbsG, nutrients.fatG, nutrients.sodiumMg);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  const catalogQuery = db.prepare(`SELECT id, name, food_group AS "group", fdc_id AS fdcId,
    energy_kcal AS energyKcal, protein_g AS proteinG, carbs_g AS carbsG,
    fat_g AS fatG, sodium_mg AS sodiumMg FROM catalog_foods
    ORDER BY CASE food_group WHEN '食材' THEN 0 WHEN '调味料' THEN 1 ELSE 2 END, name`);
  const revisionQuery = db.prepare("SELECT value FROM meta WHERE key = 'revision'");
  const profileQuery = db.prepare('SELECT row_json FROM profiles LIMIT 1');
  const queries = Object.fromEntries(COLLECTIONS.map((name) => [name, db.prepare(`SELECT row_json FROM ${name} ORDER BY date, id`)]));
  const insertProfile = db.prepare('INSERT INTO profiles (id, user_id, row_json) VALUES (?, ?, ?)');
  const inserts = Object.fromEntries(COLLECTIONS.map((name) => [name, db.prepare(`INSERT INTO ${name} (id, user_id, date, row_json) VALUES (?, ?, ?, ?)`)]));
  const bump = db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'revision'");

  function read() {
    const state = { schemaVersion: 2, profile: null, plans: [], weights: [], foods: [], trainings: [], days: [] };
    const profile = profileQuery.get();
    if (profile) state.profile = JSON.parse(profile.row_json);
    for (const name of COLLECTIONS) state[name] = queries[name].all().map((row) => JSON.parse(row.row_json));
    return { revision: revisionQuery.get().value, state };
  }

  function replace(state, expectedRevision) {
    validateServerState(state);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('修订版本无效');
    db.exec('BEGIN IMMEDIATE');
    try {
      const current = revisionQuery.get().value;
      if (current !== expectedRevision) {
        const conflict = new Error('服务器数据已变化，请重新预览后再同步');
        conflict.code = 'CONFLICT';
        throw conflict;
      }
      for (const name of [...COLLECTIONS, 'profiles']) db.exec(`DELETE FROM ${name}`);
      if (state.profile) insertProfile.run(state.profile.id, state.profile.userId, JSON.stringify(state.profile));
      for (const name of COLLECTIONS) {
        for (const row of state[name]) inserts[name].run(row.id, row.userId, row.date, JSON.stringify(row));
      }
      bump.run();
      db.exec('COMMIT');
      return current + 1;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function readCatalog() {
    return catalogQuery.all().map(({ energyKcal, proteinG, carbsG, fatG, sodiumMg, ...food }) => ({
      ...food, per100g: { energyKcal, proteinG, carbsG, fatG, sodiumMg },
    }));
  }

  return { read, readCatalog, replace, close: () => db.close() };
}
