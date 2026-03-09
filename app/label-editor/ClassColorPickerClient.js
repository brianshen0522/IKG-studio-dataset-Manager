"use client";

import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';

export default function ClassColorPickerClient({
  title,
  classNameLabel,
  selectedClass,
  selectedHex,
  onColorChange
}) {
  const [pickerColor, setPickerColor] = useColor('hex', selectedHex || '#FF6B6B');

  return (
    <div className="class-color-picker-wrap">
      <div className="class-color-picker-title">{title || 'Class Color'}</div>
      <div className="class-color-picker-label">{classNameLabel || '-'}</div>
      <ColorPicker
        width={250}
        height={120}
        color={pickerColor}
        hideHSV
        dark
        onChange={(nextColor) => {
          setPickerColor(nextColor);
          const hex = typeof nextColor?.hex === 'string' ? nextColor.hex : '';
          if (selectedClass >= 0 && hex && typeof onColorChange === 'function') {
            onColorChange(selectedClass, hex);
          }
        }}
      />
    </div>
  );
}
