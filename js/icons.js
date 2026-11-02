// Generated from assets/ui-icons/*.svg (design/). Stroke uses currentColor.
export const ICONS = {
  "add": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
  "back-up": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12M8 11l4 4 4-4\"></path><path d=\"M5 19h14\"></path></svg>",
  "back": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 5l-7 7 7 7\"></path></svg>",
  "caption": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h4L19 9l-4-4L4 16z\"></path></svg>",
  "delete": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 7h16M10 11v6M14 11v6\"></path><path d=\"M6 7l1 13h10l1-13M9 7V4h6v3\"></path></svg>",
  "heart": "<svg viewBox=\"0 0 24 24\" fill=\"var(--heart)\"><path d=\"M12 21c-5-3.6-9-7.2-9-11.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 2.8c0 4-4 7.6-9 11.2z\"></path></svg>",
  "hint": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18h6\"></path><path d=\"M10 21h4\"></path><path d=\"M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z\"></path></svg>",
  "lock": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"></rect><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"></path></svg>",
  "matched": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12.5l4.5 4.5L19 7.5\"></path></svg>",
  "photo-error": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3 15l5-5 4 4 3-3 6 6\"></path><path d=\"M4 4l16 16\"></path></svg>",
  "play": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 4.5v15l12.5-7.5z\"></path></svg>",
  "read-aloud": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 9v6h4l5 4V5L8 9H4z\"></path><path d=\"M16.5 8.5a5 5 0 0 1 0 7\"></path><path d=\"M19 6a8.5 8.5 0 0 1 0 12\"></path></svg>",
  "refresh": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-3-6.7\"></path><path d=\"M21 4v5h-5\"></path></svg>",
  "restart": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 12a9 9 0 1 0 3-6.7\"></path><path d=\"M3 4v5h5\"></path></svg>",
  "restore": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3M8 7l4-4 4 4\"></path><path d=\"M5 19h14\"></path></svg>",
  "settings": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1\"></path></svg>",
  "share": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12M8 7l4-4 4 4\"></path><path d=\"M6 11v9h12v-9\"></path></svg>",
};

/** Icon markup at a given size, hidden from assistive tech (buttons carry text). */
export function icon(name, size = 24, extra = "") {
  return ICONS[name].replace("<svg", `<svg aria-hidden="true" focusable="false" width="${size}" height="${size}" ${extra}`);
}
