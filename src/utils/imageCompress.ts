// 图片压缩工具：管理员上传图片选项时统一压缩为 JPEG dataUrl，再存后端独立 key。
// 规格：原图 ≤10MB、image/*；最长边 ≤800px（只缩小不放大）；
// 白底填充（防透明 PNG 转 JPEG 变黑）；输出 dataUrl ≤400KB（超限降质 0.65 重试一次）。

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 400 * 1024;

function loadFileImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

/**
 * 压缩图片文件为 JPEG dataUrl。
 * @returns data:image/jpeg;base64,...（≤400KB）
 */
export async function compressImageFile(file: File, maxEdge: number = 800): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('仅支持图片文件（image/*）');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('原图不能超过 10MB');
  }

  const img = await loadFileImage(file);

  // 只缩小不放大：最长边超过 maxEdge 时等比缩放
  const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持 Canvas，无法压缩图片');
  }

  // 白底填充：透明 PNG 转 JPEG 时避免变黑
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (dataUrl.length <= MAX_OUTPUT_BYTES) {
    return dataUrl;
  }

  // 超限降质重试一次，仍超则报错（后端也有 400KB 兜底校验）
  const retry = canvas.toDataURL('image/jpeg', 0.65);
  if (retry.length <= MAX_OUTPUT_BYTES) {
    return retry;
  }
  throw new Error(`图片压缩后仍超过 ${Math.round(MAX_OUTPUT_BYTES / 1024)}KB，请换一张更小的图片`);
}
