import { describe, expect, it } from 'vitest';
import { exerciseAliases, exerciseCatalog, exerciseImageUrl, filterExercises } from '../src/data/exercises';
import { loadExerciseCatalog } from '../src/services/exercises';

const filters = { query: '', muscle: '', equipment: '', level: '', category: '' };

describe('strength exercise catalog', () => {
  it('contains stable, unique strength entries with local metadata and pinned images', () => {
    expect(exerciseCatalog).toHaveLength(678);
    expect(new Set(exerciseCatalog.map((exercise) => exercise.id)).size).toBe(exerciseCatalog.length);
    expect(new Set(exerciseCatalog.map((exercise) => exercise.category)))
      .toEqual(new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman']));
    const image = exerciseCatalog.find((exercise) => exercise.images.length)?.images[0];
    expect(image && exerciseImageUrl(image)).toContain('@a859101d633a01c4a1a920d6a8ce41dabba0705f/');
  });

  it('searches Chinese aliases and combines muscle and equipment filters', () => {
    const squats = filterExercises(exerciseCatalog, { ...filters, query: '深蹲' });
    expect(squats.length).toBeGreaterThan(0);
    expect(squats.some((exercise) => exercise.name.toLowerCase().includes('squat'))).toBe(true);
    expect(exerciseAliases('Barbell Full Squat')).toContain('深蹲');
    const chestDumbbells = filterExercises(exerciseCatalog, { ...filters, muscle: 'chest', equipment: 'dumbbell' });
    expect(chestDumbbells.length).toBeGreaterThan(0);
    expect(chestDumbbells.every((exercise) => exercise.equipment === 'dumbbell'
      && [...exercise.primaryMuscles, ...exercise.secondaryMuscles].includes('chest'))).toBe(true);
  });

  it('rejects malformed remote data instead of rendering it', async () => {
    const bad = { ...exerciseCatalog[0], images: ['../outside.jpg'] };
    const transport = (async () => new Response(JSON.stringify({ exercises: [bad] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    await expect(loadExerciseCatalog('http://127.0.0.1:8787', transport)).rejects.toThrow('格式无效');
  });
});
