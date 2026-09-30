/** Focus the 3D subsurface view on an event from anywhere (side panels, lists) — no three.js import needed. */
export const SUBSURFACE_FOCUS = "nwis:subsurface-focus";

export function focusSubsurfaceEvent(eventId: string) {
  window.dispatchEvent(new CustomEvent(SUBSURFACE_FOCUS, { detail: { eventId } }));
}
