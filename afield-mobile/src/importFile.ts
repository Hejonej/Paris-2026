import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { parseInstagram } from "./instagram";
export async function pickInstagramFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset || !asset.name.toLowerCase().endsWith(".json"))
    throw Error(
      "압축을 푼 JSON 파일을 선택해 주세요. ZIP 파일은 먼저 압축을 풀어 주세요.",
    );
  const file = new File(asset.uri);
  if ((asset.size || file.size || 0) > 25 * 1024 * 1024)
    throw Error("25MB 이하의 JSON 파일을 선택해 주세요.");
  const text = await file.text();
  return { name: asset.name, collections: parseInstagram(text) };
}
