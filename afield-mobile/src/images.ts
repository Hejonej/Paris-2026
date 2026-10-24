import type { ImageSourcePropType } from "react-native";
// Bundled reference photos keep the app visually complete without image-network access.
export function imageSource(url: string): ImageSourcePropType {
  if (url.includes("1502602898657"))
    return require("../assets/photos/paris.jpg");
  if (url.includes("1560969184")) return require("../assets/photos/berlin.jpg");
  if (url.includes("1507842217343"))
    return require("../assets/photos/books.jpg");
  if (url.includes("1561214115")) return require("../assets/photos/art.jpg");
  return require("../assets/photos/landscape.jpg");
}
