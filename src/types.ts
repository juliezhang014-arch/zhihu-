export interface TextSlot {
  type?: 'text';             // Discriminator (legacy slots without type are text)
  id: string;
  label: string;             // Label tag like "穷", "顶妈", "人上人", "NPC", "拉完了", "锐评人"
  placeholder: string;       // Default placeholder text
  value: string;             // Current user input text
  // Coordinates as percentage (0-100) relative to template image width/height
  x: number;                 // X center/start percentage
  y: number;                 // Y center/start percentage
  width: number;             // Width percentage of text bounding box
  height: number;            // Height percentage of text bounding box
  align?: 'left' | 'center' | 'right';
  fontSize?: number;         // Base font size in px at reference resolution
  color?: string;            // Custom slot color override (if any)
  tagBgColor?: string;       // Left tag pill background color (e.g. #ef4444)
  tagTextColor?: string;     // Left tag text color
  fontWeight?: 'normal' | 'bold';
  locked?: boolean;          // Lock slot position to prevent accidental dragging
}

// 图片选项：管理员预置到模板中、供用户在图片库挑选的图片。
// upload 型的 dataUrl 存在后端独立 key（image:<templateId>:<optionId>），
// 绝不内嵌在模板 JSON 里（GET /api/templates 体积红线）。
export interface ImageOption {
  id: string;
  label: string;             // Display name shown in the image library
  source: 'url' | 'upload';  // External image URL, or uploaded & compressed (stored in Redis)
  url?: string;              // Only for source === 'url' (never present on upload options)
}

// 图片位：管理员在画布上自由拖框放置的图层，用户点击后从图片库选一张嵌入。
export interface ImageSlot {
  type: 'image';
  id: string;
  label?: string;            // Optional badge text on the canvas
  x: number;                 // Percentage coordinates, same convention as TextSlot
  y: number;
  width: number;
  height: number;
  value?: string;            // Selected ImageOption id (empty = placeholder)
  locked?: boolean;          // Lock slot position to prevent accidental dragging
}

export type TemplateSlot = TextSlot | ImageSlot;

// 判别守卫：有 type==='image' 的走图片分支，其余（含旧数据无 type）一律文字分支。
export function isImageSlot(slot: TemplateSlot): slot is ImageSlot {
  return (slot as ImageSlot).type === 'image';
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  aspectRatio: number;       // width / height (e.g. 0.75 for 3:4 portrait)
  width: number;             // Reference width in px (e.g. 1000)
  height: number;            // Reference height in px (e.g. 1333)
  bgType: 'draw' | 'image';  // Vector drawing or image URL
  bgImageUrl?: string;       // Optional background image URL/DataURL
  defaultFontId: string;
  defaultColor: string;
  slots: TemplateSlot[];
  imageOptions?: ImageOption[]; // 图片选项库元数据（upload 型的 dataUrl 不在此处）
  isCustomDiy?: boolean;
  isBuiltin?: boolean;
  isPublished?: boolean;     // Whether published to frontend users
  author?: string;
  allowedEditors?: string[]; // 指定开放编辑权限的管理员账号列表 (由超管分配)
  createdAt?: string;
  updatedAt?: string;
}

export type AdminRole = 'super_admin' | 'senior_admin' | 'admin';

export interface AdminPermissions {
  canEditOthers?: boolean;      // 允许编辑他人创建的模板
  canPublishOthers?: boolean;   // 允许发布/下架他人创建的模板
  canDeleteOthers?: boolean;    // 允许删除他人创建的模板
  canPublish?: boolean;         // 允许将自己名下/被指定授权的模板上线到前台（发布/下架）
  allowedTemplateIds?: string[]; // 指定开放给该管理员的特定模板 ID 列表
}

export interface AdminUser {
  username: string;
  role?: AdminRole;
  permissions?: AdminPermissions;
  createdAt?: string;
  token?: string;
}

export interface FontOption {
  id: string;
  name: string;              // Display name e.g. "站酷快乐体 (可爱)"
  fontFamily: string;        // CSS font family string e.g. "'ZCOOL KuaiLe', cursive"
  previewText?: string;
  category: 'cute' | 'calligraphy' | 'brush' | 'sans' | 'serif';
}

export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
}

export interface RenderOptions {
  globalFontFamily: string;
  globalColor: string;
  fontSizeScale: number;      // 0.8 - 1.5
  showGuidelines: boolean;    // Show connecting lines from inputs to slots
  shadowEnabled: boolean;
  fontWeight: 'normal' | 'bold';
}
