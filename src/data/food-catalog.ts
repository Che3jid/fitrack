import type { CatalogFood } from '../domain/recipe';

// USDA FoodData Central, SR Legacy (April 2018), edible portion per 100 g.
// Source: https://fdc.nal.usda.gov/download-datasets/ (CC0). Values are rounded
// exactly as listed in the downloadable food_nutrient.csv; products vary.
function food(id: string, name: string, group: CatalogFood['group'], fdcId: number, values: [number, number, number, number, number]): CatalogFood {
  const [energyKcal, proteinG, carbsG, fatG, sodiumMg] = values;
  return { id, name, group, fdcId, per100g: { energyKcal, proteinG, carbsG, fatG, sodiumMg } };
}

export const foodCatalog: readonly CatalogFood[] = [
  food('rice-white', '白米（生）', '食材', 169756, [365, 7.13, 79.95, .66, 5]),
  food('rice-brown', '糙米（生）', '食材', 169703, [367, 7.54, 76.25, 3.2, 5]),
  food('oats-dry', '燕麦片（干）', '食材', 173904, [379, 13.15, 67.7, 6.52, 6]),
  food('pasta-dry', '意面（干）', '食材', 168927, [371, 13.04, 74.67, 1.51, 6]),
  food('wheat-flour', '小麦面粉（生）', '食材', 169761, [364, 10.33, 76.31, .98, 2]),
  food('white-bread', '白面包（成品）', '食材', 174924, [266, 8.85, 49.42, 3.33, 490]),
  food('chicken-breast', '鸡胸肉（生、去皮）', '食材', 171077, [120, 22.5, 0, 2.62, 45]),
  food('chicken-thigh', '鸡腿肉（生、去皮）', '食材', 173627, [121, 19.66, 0, 4.12, 95]),
  food('pork-loin', '猪里脊（生、瘦肉）', '食材', 168230, [143, 21.43, 0, 5.66, 52]),
  food('beef-ground', '牛肉末（生、约 10% 脂肪）', '食材', 174030, [176, 20, 0, 10, 66]),
  food('egg', '鸡蛋（生、全蛋）', '食材', 171287, [143, 12.56, .72, 9.51, 142]),
  food('tofu-firm', '老豆腐', '食材', 172448, [78, 9.04, 2.85, 4.17, 12]),
  food('milk-whole', '全脂牛奶', '食材', 172217, [61, 3.15, 4.78, 3.27, 43]),
  food('cheddar', '切达奶酪', '食材', 173414, [403, 22.87, 3.37, 33.31, 653]),
  food('salmon', '三文鱼（生、野生大西洋）', '食材', 173686, [142, 19.84, 0, 6.34, 44]),
  food('shrimp', '虾（生）', '食材', 175179, [85, 20.1, 0, .51, 119]),
  food('potato', '土豆（生、带皮）', '食材', 170026, [77, 2.05, 17.49, .09, 6]),
  food('corn', '甜玉米（生）', '食材', 169998, [86, 3.27, 18.7, 1.35, 15]),
  food('kidney-beans', '红腰豆（干）', '食材', 173744, [337, 22.53, 61.29, 1.06, 12]),
  food('lentils', '扁豆（干）', '食材', 172420, [352, 24.63, 63.35, 1.06, 6]),
  food('peanuts', '花生（生）', '食材', 172430, [567, 25.8, 16.13, 49.24, 18]),
  food('tomato', '番茄（生）', '食材', 170457, [18, .88, 3.89, .2, 5]),
  food('onion', '洋葱（生）', '食材', 170000, [40, 1.1, 9.34, .1, 4]),
  food('broccoli', '西兰花（生）', '食材', 170379, [34, 2.82, 6.64, .37, 33]),
  food('spinach', '菠菜（生）', '食材', 168462, [23, 2.86, 3.63, .39, 79]),
  food('carrot', '胡萝卜（生）', '食材', 170393, [41, .93, 9.58, .24, 69]),
  food('mushroom', '白蘑菇（生）', '食材', 169251, [22, 3.09, 3.26, .34, 5]),
  food('zucchini', '西葫芦（生）', '食材', 169291, [17, 1.21, 3.11, .32, 8]),
  food('cauliflower', '花椰菜（生）', '食材', 169986, [25, 1.92, 4.97, .28, 30]),
  food('cabbage', '卷心菜（生）', '食材', 169975, [25, 1.28, 5.8, .1, 18]),
  food('red-pepper', '红甜椒（生）', '食材', 170108, [26, .99, 6.03, .3, 4]),
  food('cucumber', '黄瓜（生、带皮）', '食材', 168409, [15, .65, 3.63, .11, 2]),
  food('apple', '苹果（生、带皮）', '食材', 171688, [52, .26, 13.81, .17, 1]),
  food('banana', '香蕉（生）', '食材', 173944, [89, 1.09, 22.84, .33, 1]),
  food('salt', '食盐', '调味料', 173468, [0, 0, 0, 0, 38758]),
  food('sugar', '白砂糖', '调味料', 169655, [387, 0, 99.98, 0, 1]),
  food('soy-sauce', '酱油（普通）', '调味料', 174277, [53, 8.14, 4.93, .57, 5493]),
  food('oyster-sauce', '蚝油', '调味料', 174529, [51, 1.35, 10.92, .25, 2733]),
  food('vinegar', '白醋', '调味料', 172237, [18, 0, .04, 0, 2]),
  food('garlic', '大蒜（生）', '调味料', 169230, [149, 6.36, 33.06, .5, 17]),
  food('ginger', '姜（生）', '调味料', 169231, [80, 1.82, 17.77, .75, 13]),
  food('black-pepper', '黑胡椒粉', '调味料', 170931, [251, 10.39, 63.95, 3.26, 20]),
  food('red-chili', '红辣椒（生）', '调味料', 170106, [40, 1.87, 8.81, .44, 9]),
  food('tomato-sauce', '无盐番茄酱', '调味料', 169074, [24, 1.2, 5.31, .3, 11]),
  food('butter', '无盐黄油', '调味料', 173430, [717, .85, .06, 81.11, 11]),
  food('soybean-oil', '大豆油', '食用油', 171411, [884, 0, 0, 100, 0]),
  food('olive-oil', '橄榄油', '食用油', 171413, [884, 0, 0, 100, 2]),
  food('sesame-oil', '芝麻油', '食用油', 171016, [884, 0, 0, 100, 0]),
];

export const catalogSourceUrl = (fdcId: number): string => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
