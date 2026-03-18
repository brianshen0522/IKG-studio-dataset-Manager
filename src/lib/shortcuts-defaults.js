// Default keyboard shortcuts for the label editor and viewer.
// Keys are stored as KeyboardEvent.key values (case-insensitive for single characters).
// Ctrl/Meta combo shortcuts (Save, Copy, Paste, Undo, Redo, SelectAll) are fixed and not customizable.

export const DEFAULT_SHORTCUTS = {
  // Label editor — modifier-free
  'editor.rotateCCW':        'q',
  'editor.rotateCW':         'e',
  'editor.cancelOrClear':    'Escape',
  'editor.deleteAnnotation': 'Delete',
  'editor.classUp':          'w',
  'editor.classDown':        's',
  'editor.toggleSelect':     'x',
  'editor.navigatePrev':     'a',  // ArrowLeft is always an additional fixed key
  'editor.navigateNext':     'd',  // ArrowRight is always an additional fixed key
  // Viewer lightbox
  'viewer.lightboxClose':    'Escape',
  'viewer.lightboxPrev':     'ArrowLeft',
  'viewer.lightboxNext':     'ArrowRight',
};

export const SHORTCUT_LABELS = {
  'editor.rotateCCW':        'Rotate selection counter-clockwise',
  'editor.rotateCW':         'Rotate selection clockwise',
  'editor.cancelOrClear':    'Cancel creation / clear selection',
  'editor.deleteAnnotation': 'Delete selected annotation',
  'editor.classUp':          'Class up (previous)',
  'editor.classDown':        'Class down (next)',
  'editor.toggleSelect':     'Toggle image selection',
  'editor.navigatePrev':     'Navigate to previous image',
  'editor.navigateNext':     'Navigate to next image',
  'viewer.lightboxClose':    'Close lightbox',
  'viewer.lightboxPrev':     'Previous image in lightbox',
  'viewer.lightboxNext':     'Next image in lightbox',
};

// Human-readable key display
export function formatKey(key) {
  if (!key) return '—';
  const map = {
    Escape: 'Esc', Delete: 'Del', Backspace: '⌫',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    ' ': 'Space', Tab: 'Tab', Enter: 'Enter',
  };
  return map[key] ?? key.toUpperCase();
}
