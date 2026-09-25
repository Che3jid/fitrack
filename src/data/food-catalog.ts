import rawCatalog from './food-catalog.json';
import type { CatalogFood } from '../domain/recipe';

// Shared seed data for the offline bundle and the SQLite catalog table.
// Source: USDA FoodData Central SR Legacy (April 2018), CC0.
// https://fdc.nal.usda.gov/download-datasets/
export const foodCatalog = rawCatalog as readonly CatalogFood[];

export const catalogSourceUrl = (fdcId: number): string => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
