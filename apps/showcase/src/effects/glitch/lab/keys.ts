/** Whether a key press on `target` is typing into a text field, which the hotkeys leave alone. */
export function isTextEntry(target: EventTarget | null): boolean {
  const tagName = target !== null && "tagName" in target ? target.tagName : undefined;
  return typeof tagName === "string" && /^(INPUT|TEXTAREA)$/.test(tagName);
}
