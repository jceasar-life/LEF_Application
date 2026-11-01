import { ratingMatrices } from "./matrices.js";

export function calculateScore(application) {
  const matrix = ratingMatrices[application.loanType];

  if (!matrix) {
    throw new Error("Unsupported loan type.");
  }

  if (matrix.version === "draft" || matrix.rules.length === 0) {
    throw new Error("Rating matrix is not approved or configured.");
  }

  // Scoring calculation goes here
}
