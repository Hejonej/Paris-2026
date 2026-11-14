import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

// Keep a private durable copy: picker cache can be cleared between launches.
export async function chooseTripPhoto(folder: "trip-covers" | "journal-photos" = "trip-covers"): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.75,
    exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri || !FileSystem.documentDirectory)
    throw Error("사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.");
  if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024)
    throw Error("사진이 너무 커요. 20MB 이하 사진을 선택해 주세요.");
  const directory = FileSystem.documentDirectory + folder + "/";
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const ext = asset.uri.split(/[?#]/)[0].match(/\.(jpg|jpeg|png|heic|webp)$/i)?.[1] || "jpg";
  const destination = directory + Date.now() + "-" + Math.random().toString(36).slice(2, 9) + "." + ext;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}
