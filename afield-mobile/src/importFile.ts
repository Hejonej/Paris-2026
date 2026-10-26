import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { parseInstagram } from "./instagram";
export async function pickInstagramFile() {
  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    throw Error(
      "파일 선택창을 열지 못했어요. 다른 파일 선택창이 열려 있다면 닫고 다시 시도해 주세요.",
    );
  }
  if (result.canceled) return undefined;
  const asset = result.assets?.[0];
  if (!asset?.uri)
    throw Error(
      "선택한 파일을 찾지 못했어요. 다운로드한 파일을 다시 선택해 주세요.",
    );
  const name = asset.name || "선택한 파일";
  if (/\.zip$/i.test(name))
    throw Error(
      "ZIP 압축 파일이에요. iPhone ‘파일’ 앱에서 ZIP을 눌러 압축을 푼 뒤, 저장 항목 폴더의 .json 파일을 선택해 주세요.",
    );
  if (/\.html?$/i.test(name))
    throw Error(
      "HTML 형식으로 받은 파일이에요. Instagram 가져오기 가이드에서 JSON 형식으로 다시 내려받는 방법을 확인해 주세요.",
    );
  if ((asset.size || 0) > 25 * 1024 * 1024)
    throw Error(
      "25MB 이하의 JSON 파일을 선택해 주세요. 저장 항목 파일만 골라 주세요.",
    );
  let text: string;
  try {
    const file = new File(asset.uri);
    if ((file.size || 0) > 25 * 1024 * 1024) throw Error("too-large");
    try {
      text = await file.text();
    } catch {
      text = await LegacyFileSystem.readAsStringAsync(asset.uri);
    }
  } catch (e) {
    if (e instanceof Error && e.message === "too-large")
      throw Error("25MB 이하의 JSON 파일을 선택해 주세요.");
    throw Error(
      "선택한 파일을 기기에서 읽지 못했어요. iCloud 다운로드를 마치고 ‘나의 iPhone’에 저장한 뒤 다시 선택해 주세요. 기존 여행은 바뀌지 않았어요.",
    );
  }
  if (/^\s*<!doctype html|^\s*<html/i.test(text))
    throw Error(
      "파일 내용이 HTML이에요. Instagram에서 파일 형식을 JSON으로 선택해 다시 내려받아 주세요.",
    );
  try {
    return { name, collections: parseInstagram(text) };
  } catch (e) {
    throw Error(
      `${name}: ${e && typeof e === "object" && "message" in e ? String(e.message) : "파일 내용을 확인하지 못했어요."}`,
    );
  }
}
