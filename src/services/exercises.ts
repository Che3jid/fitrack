import type { Exercise } from '../data/exercises';
import { serverUrl } from './sync';

function validExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== 'object') return false;
  const exercise = value as Partial<Exercise>;
  const id = exercise.id;
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(id)
    && typeof exercise.name === 'string' && exercise.name.length > 0 && exercise.name.length <= 100
    && ['strength', 'powerlifting', 'olympic weightlifting', 'strongman'].includes(exercise.category ?? '')
    && ['beginner', 'intermediate', 'expert'].includes(exercise.level ?? '')
    && (exercise.equipment === null || (typeof exercise.equipment === 'string' && exercise.equipment.length <= 80))
    && Array.isArray(exercise.primaryMuscles) && exercise.primaryMuscles.every((item) => typeof item === 'string' && item.length <= 80)
    && Array.isArray(exercise.secondaryMuscles) && exercise.secondaryMuscles.every((item) => typeof item === 'string' && item.length <= 80)
    && Array.isArray(exercise.instructions) && exercise.instructions.every((item) => typeof item === 'string' && item.length <= 2000)
    && Array.isArray(exercise.images) && exercise.images.every((path) => typeof path === 'string' && path.startsWith(`${id}/`)
      && /^[A-Za-z0-9_.-]+\/[0-9]+\.jpg$/.test(path));
}

export async function loadExerciseCatalog(url: string, transport: typeof fetch = fetch): Promise<readonly Exercise[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await transport(serverUrl(url, '/api/exercises'), { method: 'GET', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`动作库服务器返回 ${response.status}。`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('exercises' in payload) || !Array.isArray(payload.exercises)
      || !payload.exercises.length || payload.exercises.length > 10_000 || !payload.exercises.every(validExercise)
      || new Set(payload.exercises.map((exercise: Exercise) => exercise.id)).size !== payload.exercises.length) {
      throw new Error('服务器动作库格式无效。');
    }
    return payload.exercises;
  } catch (cause) {
    if (cause instanceof TypeError || (cause instanceof DOMException && cause.name === 'AbortError')) {
      throw new Error('无法连接动作库服务器，请检查地址与网络。');
    }
    throw cause;
  } finally { clearTimeout(timer); }
}
