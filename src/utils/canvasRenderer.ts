import { Template, RenderOptions, ImageSlot, TextSlot, isImageSlot } from '../types';

/**
 * Draws the entire template poster and text slots onto an HTML5 Canvas.
 * Supports high DPI rendering for crisp export.
 */
export async function renderTemplateToCanvas(
  canvas: HTMLCanvasElement,
  template: Template,
  options: RenderOptions,
  scale: number = 2, // 2x for high resolution export/preview
  imagesMap: Record<string, string> = {} // upload 型图片选项的 dataUrl（optionId -> dataUrl），url 型直连
): Promise<void> {
  const width = template.width * scale;
  const height = template.height * scale;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Background
  if (template.bgType === 'image') {
    if (template.bgImageUrl) {
      await drawImageBackground(ctx, template.bgImageUrl, width, height);
    } else {
      // 背景 dataUrl 尚未拉取（模板 JSON 已剥离背景）：画中性占位，
      // 绝不落入下方矢量底图分支 —— 否则切换模板瞬间会闪现错误的矢量海报
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, width, height);
      if (options.showGuidelines) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${16 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('背景加载中…', width / 2, height / 2);
      }
    }
  } else {
    drawVectorPosterBackground(ctx, template, width, height);
  }

  // 2. Draw Slots (image slots first, then text slots)
  for (const slot of template.slots) {
    if (isImageSlot(slot)) {
      await drawSlotImage(ctx, slot, template, imagesMap, options, scale, width, height);
    } else {
      drawSlotText(ctx, slot, template, options, scale, width, height);
    }
  }
}

/**
 * 加载图片（crossOrigin=anonymous 避免画布污染；
 * 失败返回 null 由调用方决定回退，绝不 throw 破坏整图渲染）。
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Renders custom image background when user uploads an image.
 */
async function drawImageBackground(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  width: number,
  height: number
): Promise<void> {
  const img = await loadImage(imageUrl);
  if (img) {
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    // Fallback gray fill
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * 渲染图片位：cover-fit 居中裁剪嵌入选中图片；
 * 无图或加载失败时（仅在 showGuidelines 模式）画虚线占位框，不污染成图。
 */
async function drawSlotImage(
  ctx: CanvasRenderingContext2D,
  slot: ImageSlot,
  template: Template,
  imagesMap: Record<string, string>,
  options: RenderOptions,
  scale: number,
  canvasW: number,
  canvasH: number
): Promise<void> {
  const boxX = (slot.x / 100) * canvasW;
  const boxY = (slot.y / 100) * canvasH;
  const boxW = (slot.width / 100) * canvasW;
  const boxH = (slot.height / 100) * canvasH;
  const radius = 8 * scale;

  const option = (template.imageOptions || []).find((o) => o.id === slot.value);
  const src = option
    ? option.source === 'url'
      ? option.url
      : imagesMap[option.id]
    : undefined;

  if (!src) {
    if (options.showGuidelines) {
      drawImagePlaceholder(ctx, boxX, boxY, boxW, boxH, radius, scale, '图片位');
    }
    return;
  }

  const img = await loadImage(src);
  if (!img) {
    if (options.showGuidelines) {
      drawImagePlaceholder(ctx, boxX, boxY, boxW, boxH, radius, scale, '图片加载失败');
    }
    return;
  }

  // cover-fit：等比缩放铺满框并居中裁剪
  const ratio = Math.max(boxW / img.width, boxH / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;

  ctx.save();
  roundRect(ctx, boxX, boxY, boxW, boxH, radius);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * 图片位虚线占位框（编辑态提示用）
 */
function drawImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  radius: number,
  scale: number,
  text: string
) {
  ctx.save();
  ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
  roundRect(ctx, boxX, boxY, boxW, boxH, radius);
  ctx.fill();
  ctx.setLineDash([6 * scale, 4 * scale]);
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = Math.max(1.5, 1.5 * scale);
  roundRect(ctx, boxX, boxY, boxW, boxH, radius);
  ctx.stroke();
  ctx.setLineDash([]);

  const fontSize = Math.max(10, Math.min(boxH * 0.3, boxW * 0.25, 24 * scale));
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#0ea5e9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
  ctx.restore();
}

/**
 * Renders the vector poster background (e.g., "民间锐评人 请就位").
 */
function drawVectorPosterBackground(
  ctx: CanvasRenderingContext2D,
  template: Template,
  width: number,
  height: number
) {
  // Theme color variables based on template
  let primaryBlue = '#1e40af';
  let curtainColor = '#2563eb';
  let cardBorderColor = '#2563eb';

  if (template.id === 'movie-tier-list') {
    primaryBlue = '#0f172a';
    curtainColor = '#1e293b';
    cardBorderColor = '#3b82f6';
  } else if (template.id === 'opinion-card') {
    primaryBlue = '#111827';
    curtainColor = '#1f2937';
    cardBorderColor = '#10b981';
  }

  // 1. Outer Dark/Blue Stage Background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, primaryBlue);
  bgGradient.addColorStop(1, '#0284c7');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Side Stage Curtains
  const curtainWidth = width * 0.08;
  
  // Left Curtain
  const leftCurtainGrad = ctx.createLinearGradient(0, 0, curtainWidth, 0);
  leftCurtainGrad.addColorStop(0, '#1d4ed8');
  leftCurtainGrad.addColorStop(0.5, curtainColor);
  leftCurtainGrad.addColorStop(1, 'rgba(29, 78, 216, 0.3)');
  ctx.fillStyle = leftCurtainGrad;
  ctx.fillRect(0, 0, curtainWidth, height);

  // Right Curtain
  const rightCurtainGrad = ctx.createLinearGradient(width - curtainWidth, 0, width, 0);
  rightCurtainGrad.addColorStop(0, 'rgba(29, 78, 216, 0.3)');
  rightCurtainGrad.addColorStop(0.5, curtainColor);
  rightCurtainGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = rightCurtainGrad;
  ctx.fillRect(width - curtainWidth, 0, curtainWidth, height);

  // 3. Header Stage Title Area
  ctx.save();
  
  // Outer Banner Box or Title Artwork
  const headerY = height * 0.05;
  
  // Speech bubble & Badges
  if (template.id === 'folk-reviewer') {
    // English Tag pill
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, width * 0.35, headerY, width * 0.3, height * 0.025, 12 * (width / 900));
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${13 * (width / 900)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TAKE YOUR SEAT • SHARE YOUR TAKE', width * 0.5, headerY + height * 0.017);

    // Main Title: "民间锐评人"
    ctx.font = `900 ${62 * (width / 900)}px 'ZCOOL KuaiLe', 'Noto Sans SC', sans-serif`;
    ctx.textAlign = 'center';
    
    // Title Shadow
    ctx.fillStyle = '#0f172a';
    ctx.fillText('民间锐评人', width * 0.44 + 4, headerY + height * 0.09 + 4);
    
    // Title Main Fill
    ctx.fillStyle = '#fef08a';
    ctx.fillText('民间锐评人', width * 0.44, headerY + height * 0.09);

    // Subtitle Action Text: "请就位"
    ctx.font = `900 ${48 * (width / 900)}px 'ZCOOL KuaiLe', cursive`;
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('请就位 ✍️', width * 0.72, headerY + height * 0.11);

    // Cartoon Peanut / Mascot Illustration Box
    const mascotX = width * 0.18;
    const mascotY = headerY + height * 0.02;
    const mascotR = 36 * (width / 900);
    
    // Mascot circle background
    ctx.beginPath();
    ctx.arc(mascotX, mascotY + mascotR, mascotR, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.lineWidth = 3 * (width / 900);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Mascot Emoji / Icon
    ctx.font = `${40 * (width / 900)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🥜', mascotX, mascotY + mascotR);
    ctx.textBaseline = 'alphabetic'; // Reset

    // Subtitle capsule banner: "不做沉默群众 当民间锐评员"
    const subBannerY = headerY + height * 0.14;
    const subBannerW = width * 0.52;
    const subBannerH = height * 0.035;
    const subBannerX = (width - subBannerW) / 2;

    ctx.fillStyle = '#1e3a8a';
    roundRect(ctx, subBannerX, subBannerY, subBannerW, subBannerH, 16 * (width / 900));
    ctx.fill();
    ctx.lineWidth = 2 * (width / 900);
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    ctx.font = `bold ${18 * (width / 900)}px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.fillText('不做沉默群众  当民间锐评员', width * 0.5, subBannerY + subBannerH * 0.68);
  } else if (template.id === 'movie-tier-list') {
    // Tier List Header
    ctx.fillStyle = '#3b82f6';
    roundRect(ctx, width * 0.2, headerY + height * 0.02, width * 0.6, height * 0.03, 14 * (width / 900));
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * (width / 900)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('MOVIE & DRAMA RATING TIER', width * 0.5, headerY + height * 0.042);

    ctx.font = `900 ${58 * (width / 900)}px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('年度影剧红黑榜', width * 0.5, headerY + height * 0.11);
  } else {
    // Opinion Card Header
    ctx.font = `900 ${56 * (width / 900)}px 'Noto Serif SC', serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText('极简生活表态卡', width * 0.5, headerY + height * 0.1);
  }
  ctx.restore();

  // 4. Main Ranking Container Card
  const cardX = width * 0.12;
  const cardY = height * 0.24;
  const cardW = width * 0.76;
  const cardH = height * 0.53;
  const borderRadius = 20 * (width / 900);

  // Outer blue rounded border box
  ctx.fillStyle = cardBorderColor;
  roundRect(ctx, cardX, cardY, cardW, cardH, borderRadius);
  ctx.fill();

  // Card Inner Canvas (White/Light Blue background)
  const cardPadding = 12 * (width / 900);
  ctx.fillStyle = '#f8fafc';
  roundRect(
    ctx,
    cardX + cardPadding,
    cardY + cardPadding,
    cardW - cardPadding * 2,
    cardH - cardPadding * 2,
    borderRadius - 4
  );
  ctx.fill();

  // 5. Draw Row Background Bars and Tag Pills for Each Slot
  const slots = template.slots;
  // 排行行条只对文字位生效（图片位由 drawSlotImage 单独渲染）
  const slotBars = slots.filter((s): s is TextSlot => !isImageSlot(s) && s.id !== 'slot-reviewer' && s.id !== 'tier-author' && s.id !== 'op-author');

  slotBars.forEach((slot, index) => {
    const slotX = (slot.x / 100) * width;
    const slotY = (slot.y / 100) * height - (slot.height / 100 * height) / 2;
    const slotW = (slot.width / 100) * width;
    const slotH = (slot.height / 100) * height;

    // Background color for pale text bar
    const barColors = ['#fee2e2', '#ffedd5', '#fef3c7', '#fef9c3', '#e0f2fe'];
    const barColor = barColors[index % barColors.length];

    // Draw pale slot box for user text input
    ctx.fillStyle = barColor;
    roundRect(ctx, slotX, slotY, slotW, slotH, 8 * (width / 900));
    ctx.fill();
    ctx.lineWidth = 1 * (width / 900);
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Draw left Tag Pill (e.g. "穷", "顶妈", "人上人", "NPC", "拉完了")
    const tagW = width * 0.12;
    const tagX = slotX - tagW - width * 0.02;
    const tagH = slotH;

    ctx.fillStyle = slot.tagBgColor || '#ef4444';
    roundRect(ctx, tagX, slotY, tagW, tagH, 6 * (width / 900));
    ctx.fill();

    // Tag Text
    ctx.fillStyle = slot.tagTextColor || '#ffffff';
    ctx.font = `bold ${22 * (width / 900)}px 'Noto Sans SC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.label, tagX + tagW / 2, slotY + tagH / 2);
    ctx.textBaseline = 'alphabetic'; // Reset
  });

  // 6. Draw Bottom Reviewer Line Area ("锐评人: @_____")
  const reviewerSlot = slots.find((s) => s.id === 'slot-reviewer' || s.id === 'tier-author' || s.id === 'op-author');
  if (reviewerSlot) {
    const lineY = (reviewerSlot.y / 100) * height;
    ctx.font = `bold ${22 * (width / 900)}px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('锐评人: @', width * 0.22, lineY);

    // Underline
    ctx.beginPath();
    ctx.moveTo(width * 0.38, lineY + 6);
    ctx.lineTo(width * 0.76, lineY + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * (width / 900);
    ctx.stroke();
  }

  // 7. Draw Bottom Logo & Spotlights
  const footerY = height * 0.86;

  // Search box badge (Zhihu style)
  const searchW = width * 0.38;
  const searchH = height * 0.04;
  const searchX = (width - searchW) / 2;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, searchX, footerY, searchW, searchH, 8 * (width / 900));
  ctx.fill();

  ctx.fillStyle = '#2563eb';
  ctx.font = `bold ${16 * (width / 900)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('知乎', searchX + 16 * (width / 900), footerY + searchH * 0.65);

  ctx.fillStyle = '#64748b';
  ctx.font = `${15 * (width / 900)}px sans-serif`;
  ctx.fillText('民间锐评人', searchX + 64 * (width / 900), footerY + searchH * 0.65);

  // Search Icon 🔍
  ctx.font = `${16 * (width / 900)}px sans-serif`;
  ctx.fillText('🔍', searchX + searchW - 28 * (width / 900), footerY + searchH * 0.68);

  // Spotlight Lamps at bottom corners
  drawSpotlight(ctx, width * 0.12, height * 0.93, width, height, 'left');
  drawSpotlight(ctx, width * 0.88, height * 0.93, width, height, 'right');
}

/**
 * Draws stage spotlight graphic
 */
function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
  direction: 'left' | 'right'
) {
  ctx.save();
  // Spotlight stand
  ctx.fillStyle = '#334155';
  roundRect(ctx, x - 20, y, 40, 20, 6);
  ctx.fill();

  // Lamp Head
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(x, y - 10, 16, 0, Math.PI * 2);
  ctx.fill();

  // Light beamcone
  const beamGrad = ctx.createLinearGradient(x, y - 10, direction === 'left' ? x + 120 : x - 120, y - 250);
  beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  if (direction === 'left') {
    ctx.lineTo(x + 200, y - 300);
    ctx.lineTo(x + 80, y - 320);
  } else {
    ctx.lineTo(x - 200, y - 300);
    ctx.lineTo(x - 80, y - 320);
  }
  ctx.closePath();
  ctx.fillStyle = beamGrad;
  ctx.fill();

  ctx.restore();
}

/**
 * Helper to split text into lines with CJK and Latin automatic wrapping
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rawParagraphs = text.split(/\r?\n/);
  const resultLines: string[] = [];

  for (const paragraph of rawParagraphs) {
    if (!paragraph) {
      resultLines.push('');
      continue;
    }

    let currentLine = '';
    for (let i = 0; i < paragraph.length; i++) {
      const char = paragraph[i];
      const testLine = currentLine + char;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > maxWidth && currentLine.length > 0) {
        resultLines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.length > 0) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

/**
 * Renders individual slot text with auto-wrapping and proper multi-line alignment.
 */
function drawSlotText(
  ctx: CanvasRenderingContext2D,
  slot: TextSlot,
  template: Template,
  options: RenderOptions,
  scale: number,
  canvasW: number,
  canvasH: number
) {
  const rawText = slot.value.trim();
  const isPlaceholder = !rawText;
  const text = isPlaceholder ? (slot.placeholder || '').trim() : rawText;

  if (!text) return;

  ctx.save();

  // Calculate box dimensions
  const boxX = (slot.x / 100) * canvasW;
  const boxY = (slot.y / 100) * canvasH;
  const boxW = (slot.width / 100) * canvasW;
  const boxH = (slot.height / 100) * canvasH;

  // Font setup
  const fontFamily = options.globalFontFamily || "'ZCOOL KuaiLe', sans-serif";
  const baseFontSize = (slot.fontSize || 26) * (canvasW / 900) * options.fontSizeScale;
  
  let fontColor = slot.color || template.defaultColor || options.globalColor || '#1e293b';
  if (isPlaceholder) {
    if (slot.id === 'slot-reviewer' || fontColor.toLowerCase() === '#fdd937') {
      fontColor = 'rgba(253, 217, 55, 0.65)';
    } else if (fontColor.toLowerCase() === '#ffffff' || fontColor.toLowerCase() === '#fff') {
      fontColor = 'rgba(255, 255, 255, 0.65)';
    } else if (fontColor.startsWith('#') && fontColor.length === 7) {
      fontColor = fontColor + '70';
    } else {
      fontColor = 'rgba(30, 41, 59, 0.45)';
    }
  }

  ctx.fillStyle = fontColor;
  ctx.textBaseline = 'middle';

  // Apply shadow if enabled
  if (options.shadowEnabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }

  const isBold = options.fontWeight === 'bold' || slot.fontWeight === 'bold';
  const maxAllowedW = Math.max(10, boxW * 0.94);
  const maxAllowedH = Math.max(10, boxH * 0.92);
  const minFontSize = Math.max(12 * scale, 12);

  let currentFontSize = baseFontSize;
  let lines: string[] = [];
  let lineHeight = currentFontSize * 1.28;

  // Automatically wrap text into lines and adjust font size if lines exceed available height
  for (let attempt = 0; attempt < 8; attempt++) {
    ctx.font = `${isBold ? 'bold ' : ''}${currentFontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, maxAllowedW);
    lineHeight = currentFontSize * 1.28;
    const totalH = lines.length * lineHeight;

    if (totalH <= maxAllowedH || currentFontSize <= minFontSize) {
      break;
    }

    const ratio = Math.max(0.75, Math.min(0.92, maxAllowedH / totalH));
    currentFontSize = Math.max(minFontSize, Math.floor(currentFontSize * ratio));
  }

  ctx.font = `${isBold ? 'bold ' : ''}${currentFontSize}px ${fontFamily}`;

  // Text Alignment
  const align = slot.align || 'left';
  let textX = boxX;
  if (align === 'center') {
    textX = boxX + boxW / 2;
    ctx.textAlign = 'center';
  } else if (align === 'right') {
    textX = boxX + boxW * 0.97;
    ctx.textAlign = 'right';
  } else {
    // Left align with small padding
    textX = boxX + boxW * 0.03;
    ctx.textAlign = 'left';
  }

  // Draw multi-line text block vertically centered within [boxY, boxY + boxH]
  const totalBlockH = lines.length * lineHeight;
  const startY = totalBlockH < boxH
    ? boxY + (boxH - totalBlockH) / 2 + (lineHeight / 2)
    : boxY + (lineHeight / 2) + 2;

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    ctx.fillText(line, textX, lineY);
  });

  ctx.restore();
}

/**
 * Helper to draw rounded rectangle paths
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
