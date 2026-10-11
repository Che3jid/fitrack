import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './database.mjs';
import { createFitTrackServer } from './index.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const stamp = '2026-09-24T00:00:00.000Z';
const entity = (id, date) => ({ id, userId: 'user-1', schemaVersion: 1, createdAt: stamp, updatedAt: stamp, ...(date ? { date } : {}) });
function populated() {
  return {
    schemaVersion: 2,
    profile: { ...entity('profile-1'), sex: 'female', ageYears: 28, heightCm: 165, weightKg: 60, activityLevel: 'moderate', goal: 'maintain' },
    plans: [{ ...entity('plan-1', '2026-09-24'), profileSnapshot: { sex: 'female', ageYears: 28, heightCm: 165, weightKg: 60, activityLevel: 'moderate', goal: 'maintain' }, bmrKcal: 1330, tdeeKcal: 2061.5, targetKcal: 2061.5, calculationVersion: 'mifflin-v1' }],
    weights: [{ ...entity('weight-1', '2026-09-24'), weightKg: 60 }],
    foods: [{ ...entity('food-1', '2026-09-24'), mealType: 'breakfast', name: '燕麦', weightG: 60, energyKcal: 228, proteinG: 8, carbsG: 40, fatG: 4 }],
    trainings: [{ ...entity('training-1', '2026-09-24'), exerciseType: '力量训练', durationMin: 45, estimatedKcal: 260, estimateSource: 'manual' }],
    days: [{ ...entity('day-1', '2026-09-24'), dietCompleted: true }],
  };
}

test('SQLite keeps all record collections and rejects stale replacements without changing data', () => {
  const database = openDatabase(':memory:');
  try {
    assert.equal(database.read().revision, 0);
    const state = populated();
    assert.equal(database.replace(state, 0), 1);
    assert.deepEqual(database.read(), { revision: 1, state });
    assert.throws(() => database.replace({ ...state, foods: [] }, 0), /服务器数据已变化/);
    assert.deepEqual(database.read(), { revision: 1, state });
    assert.throws(() => database.replace({ ...state, foods: [{ ...state.foods[0], energyKcal: -1 }] }, 1), /饮食记录无效/);
    assert.deepEqual(database.read(), { revision: 1, state });
  } finally { database.close(); }
});

test('SQLite keeps optional supplement plan and daily check-ins through replacement', () => {
  const database = openDatabase(':memory:');
  try {
    const state = populated();
    state.profile.supplementPlan = [{ id: 'creatine', name: '肌酸' }];
    state.days[0].supplementTakenIds = ['creatine'];
    database.replace(state, 0);
    assert.deepEqual(database.read().state.profile.supplementPlan, state.profile.supplementPlan);
    assert.deepEqual(database.read().state.days[0].supplementTakenIds, ['creatine']);
    const invalid = structuredClone(state);
    invalid.days[0].supplementTakenIds = ['creatine', 'creatine'];
    assert.throws(() => database.replace(invalid, 1), /完成状态无效/);
    assert.deepEqual(database.read().state, state);
  } finally { database.close(); }
});

test('records remain available after closing and reopening the database file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fittrack-db-'));
  const path = join(directory, 'fittrack.sqlite');
  try {
    const first = openDatabase(path);
    first.replace(populated(), 0);
    first.close();
    const second = openDatabase(path);
    try { assert.deepEqual(second.read(), { revision: 1, state: populated() }); }
    finally { second.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('catalog is stored in SQLite, survives user-state replacement and preserves database edits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fittrack-catalog-'));
  const path = join(directory, 'fittrack.sqlite');
  try {
    const database = openDatabase(path);
    assert.equal(database.readCatalog().length, 48);
    assert.equal(database.readCatalog().find((food) => food.id === 'egg')?.per100g.energyKcal, 143);
    database.replace(populated(), 0);
    assert.equal(database.readCatalog().length, 48);
    database.close();

    const sqlite = new DatabaseSync(path);
    sqlite.prepare("UPDATE catalog_foods SET name = '测试鸡蛋' WHERE id = 'egg'").run();
    sqlite.close();
    const reopened = openDatabase(path);
    try { assert.equal(reopened.readCatalog().find((food) => food.id === 'egg')?.name, '测试鸡蛋'); }
    finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('exercise catalog is seeded in SQLite and survives record changes and reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fittrack-exercises-'));
  const path = join(directory, 'fittrack.sqlite');
  try {
    const database = openDatabase(path);
    assert.equal(database.readExerciseCatalog().length, 678);
    database.replace(populated(), 0);
    assert.equal(database.readExerciseCatalog().length, 678);
    database.close();
    const sqlite = new DatabaseSync(path);
    const id = sqlite.prepare('SELECT id FROM catalog_exercises LIMIT 1').get().id;
    const row = JSON.parse(sqlite.prepare('SELECT row_json FROM catalog_exercises WHERE id = ?').get(id).row_json);
    sqlite.prepare('UPDATE catalog_exercises SET row_json = ? WHERE id = ?').run(JSON.stringify({ ...row, name: '测试动作' }), id);
    sqlite.close();
    const reopened = openDatabase(path);
    try {
      assert.equal(reopened.readExerciseCatalog().length, 678);
      assert.equal(reopened.readExerciseCatalog().find((exercise) => exercise.id === id)?.name, '测试动作');
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('HTTP API requires a token, accepts explicit writes and reports conflicts', async () => {
  const database = openDatabase(':memory:');
  const server = createFitTrackServer({ database, token: 'test-secret' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/state`;
  try {
    const catalog = await fetch(url.replace('/api/state', '/api/catalog'));
    assert.equal(catalog.status, 200);
    assert.equal((await catalog.json()).foods.length, 48);
    const exercises = await fetch(url.replace('/api/state', '/api/exercises'));
    assert.equal(exercises.status, 200);
    assert.equal((await exercises.json()).exercises.length, 678);
    const exercisesPost = await fetch(url.replace('/api/state', '/api/exercises'), { method: 'POST' });
    assert.equal(exercisesPost.status, 405);
    const missing = await fetch(url);
    assert.equal(missing.status, 401);
    const headers = { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json', Origin: 'null' };
    const initial = await fetch(url, { headers });
    assert.deepEqual(await initial.json(), { revision: 0, state: database.read().state });
    const write = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ state: populated(), expectedRevision: 0 }) });
    assert.equal(write.status, 200);
    assert.deepEqual(await write.json(), { revision: 1 });
    const stale = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ state: populated(), expectedRevision: 0 }) });
    assert.equal(stale.status, 409);
    assert.equal(database.read().state.foods[0].name, '燕麦');
    const foreign = await fetch(url, { headers: { ...headers, Origin: 'https://untrusted.example' } });
    assert.equal(foreign.status, 403);
    const android = await fetch(url, { headers: { ...headers, Origin: 'https://appassets.androidplatform.net' } });
    assert.equal(android.status, 200);
    assert.equal(android.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  }
});
