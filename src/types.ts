export interface TextSlot {
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
  slots: TextSlot[];
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
