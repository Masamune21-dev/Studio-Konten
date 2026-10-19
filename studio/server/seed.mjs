import { setting, setSetting } from "./db.mjs";
import { brandProfile } from "../../scripts/brand.mjs";

// First-run content. A new database starts with the brand profile only (brand/profile.md, or
// brand.example/profile.md); ideas and videos are made from the dashboard.

export function seed() {
  if (!setting("brand_profile")) setSetting("brand_profile", brandProfile());
}
