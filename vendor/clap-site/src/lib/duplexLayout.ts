// Mirror positions across the sheet, never the artwork or the text itself.
export function mirroredSheetSlot(index: number, columns: number) {
  return Math.floor(index / columns) * columns + columns - 1 - index % columns;
}
