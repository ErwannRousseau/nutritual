import { forms } from "@/features/routines/product-forms";

export const units = [
  "capsule",
  "tablet",
  "lozenge",
  "gummy",
  "drop",
  "microgram",
  "milligram",
  "gram",
  "millilitre",
  "litre",
  "scoop",
  "teaspoon",
  "tablespoon",
  "spray",
];

const relatedUnits = {
  Capsule: ["capsule"],
  Tablet: ["tablet"],
  Lozenge: ["lozenge"],
  Gummy: ["gummy"],
  Powder: ["gram", "scoop", "teaspoon", "tablespoon"],
  Liquid: ["millilitre", "litre", "teaspoon", "tablespoon"],
  Drops: ["drop"],
} satisfies Record<(typeof forms)[number], string[]>;

export function unitOptions(form: string): string[] {
  const selectedForm = forms.find((value) => value.toLowerCase() === form.toLowerCase());
  const relevant = selectedForm ? relatedUnits[selectedForm] : [];

  return [...relevant, ...units.filter((unit) => !relevant.includes(unit))];
}
