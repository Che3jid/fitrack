import rawExercises from './exercise-catalog.json';

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'powerlifting' | 'olympic weightlifting' | 'strongman';
  level: 'beginner' | 'intermediate' | 'expert';
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

export const EXERCISE_SOURCE_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f';
export const exerciseCatalog = rawExercises as readonly Exercise[];
export const exerciseSourceUrl = (id: string): string =>
  `https://github.com/yuhonas/free-exercise-db/blob/${EXERCISE_SOURCE_COMMIT}/exercises/${encodeURIComponent(id)}.json`;
export const exerciseImageUrl = (path: string): string =>
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${EXERCISE_SOURCE_COMMIT}/exercises/${path.split('/').map(encodeURIComponent).join('/')}`;

export const muscleLabels: Record<string, string> = {
  abdominals: '腹肌', abductors: '髋外展肌', adductors: '髋内收肌', biceps: '肱二头肌', calves: '小腿',
  chest: '胸肌', forearms: '前臂', glutes: '臀肌', hamstrings: '腘绳肌', lats: '背阔肌',
  'lower back': '下背部', 'middle back': '中背部', neck: '颈部', quadriceps: '股四头肌',
  shoulders: '肩部', traps: '斜方肌', triceps: '肱三头肌',
};
export const equipmentLabels: Record<string, string> = {
  barbell: '杠铃', dumbbell: '哑铃', cable: '绳索', 'body only': '徒手', machine: '固定器械',
  kettlebells: '壶铃', bands: '弹力带', 'e-z curl bar': '曲杆', 'exercise ball': '健身球',
  'medicine ball': '药球', other: '其他',
};
export const categoryLabels: Record<Exercise['category'], string> = {
  strength: '力量训练', powerlifting: '力量举', 'olympic weightlifting': '举重', strongman: '大力士',
};
export const levelLabels: Record<Exercise['level'], string> = { beginner: '入门', intermediate: '进阶', expert: '高阶' };

const chineseAliases: ReadonlyArray<readonly [string, string]> = [
  ['squat', '深蹲'], ['deadlift', '硬拉'], ['bench press', '卧推'], ['pull-up', '引体向上'],
  ['chin-up', '引体向上'], ['push-up', '俯卧撑'], ['row', '划船'], ['lunge', '弓步'],
  ['shoulder press', '肩推'], ['plank', '平板支撑'], ['curl', '弯举'], ['dip', '臂屈伸'],
  ['lat pulldown', '高位下拉'], ['leg press', '腿举'], ['crunch', '卷腹'],
];
export function exerciseAliases(name: string): string[] {
  const lower = name.toLowerCase();
  return [...new Set(chineseAliases.filter(([english]) => lower.includes(english)).map(([, chinese]) => chinese))];
}

export interface ExerciseFilter { query: string; muscle: string; equipment: string; level: string; category: string }
export function filterExercises(items: readonly Exercise[], filter: ExerciseFilter): Exercise[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return items.filter((exercise) => {
    if (filter.muscle && !exercise.primaryMuscles.includes(filter.muscle) && !exercise.secondaryMuscles.includes(filter.muscle)) return false;
    if (filter.equipment && (exercise.equipment ?? 'other') !== filter.equipment) return false;
    if (filter.level && exercise.level !== filter.level) return false;
    if (filter.category && exercise.category !== filter.category) return false;
    if (!query) return true;
    const terms = [exercise.name, exercise.id, ...exerciseAliases(exercise.name), categoryLabels[exercise.category], levelLabels[exercise.level],
      exercise.equipment ?? '', equipmentLabels[exercise.equipment ?? 'other'] ?? '',
      ...exercise.primaryMuscles.flatMap((muscle) => [muscle, muscleLabels[muscle] ?? '']),
      ...exercise.secondaryMuscles.flatMap((muscle) => [muscle, muscleLabels[muscle] ?? ''])];
    return terms.some((term) => term.toLocaleLowerCase().includes(query));
  });
}
