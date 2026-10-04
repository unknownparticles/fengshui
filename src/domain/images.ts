import { nowISO, uid, type Attachment } from "./model";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function imageFormat(bytes: Uint8Array): Attachment["mime"] {
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return "image/png";
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new Error(
    "仅支持真实 PNG、JPEG 或 WebP 图片，文件可能损坏或格式不支持",
  );
}
export function imageDimensions(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  const mime = imageFormat(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 255) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (
        marker === 216 ||
        marker === 217 ||
        (marker >= 208 && marker <= 215)
      ) {
        offset += 2;
        continue;
      }
      if (marker === 218) break;
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 7
      )
        return {
          width: view.getUint16(offset + 7),
          height: view.getUint16(offset + 5),
        };
      offset += 2 + length;
    }
  } else {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X")
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (chunk === "VP8L" && bytes[20] === 47)
      return {
        width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
        height:
          1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10),
      };
    if (
      chunk === "VP8 " &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    )
      return {
        width: view.getUint16(26, true) & 16383,
        height: view.getUint16(28, true) & 16383,
      };
  }
  throw new Error("无法读取图片尺寸，请使用标准 PNG、JPEG 或 WebP");
}
export function checkImage(bytes: Uint8Array) {
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new Error("单张图片不得超过 10 MiB");
  const dimensions = imageDimensions(bytes);
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width * dimensions.height > 20_000_000
  )
    throw new Error("图片尺寸不合法或超过 2000 万像素");
  return { ...dimensions, mime: imageFormat(bytes) };
}
export async function prepareImage(
  file: Blob,
  kind: Attachment["kind"],
): Promise<Attachment> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("单张图片不得超过 10 MiB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkImage(bytes);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("图片无法解码，原有图纸已保留");
  }
  try {
    if (bitmap.width * bitmap.height > 20_000_000)
      throw new Error("图片超过 2000 万像素");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法处理图片");
    ctx.drawImage(bitmap, 0, 0);
    const encoded = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("图片重新编码失败")),
        "image/png",
      ),
    );
    const clean = new Uint8Array(await encoded.arrayBuffer());
    checkImage(clean);
    return {
      id: uid(),
      kind,
      mime: "image/png",
      width: bitmap.width,
      height: bitmap.height,
      bytes: clean,
      createdAt: nowISO(),
    };
  } finally {
    bitmap.close();
  }
}
export function imageDataURL(attachment: Attachment) {
  let binary = "";
  for (let offset = 0; offset < attachment.bytes.length; offset += 8192)
    binary += String.fromCharCode(
      ...attachment.bytes.slice(offset, offset + 8192),
    );
  return `data:${attachment.mime};base64,${btoa(binary)}`;
}
