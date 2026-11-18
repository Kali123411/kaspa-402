// The review sheet's state: each sheet has an id, and a preview only lands in the sheet that asked for it.

/** Apply preview `p` (built + description) to `sheet` if it is still sheet `id`. */
export function applyPreview(sheet, id, p) {
  if (!sheet || sheet.id !== id) return sheet;
  return { ...sheet, ...p, status: 'review' };
}
