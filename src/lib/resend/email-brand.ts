export const EMAIL_COLORS = {
  canvas: "#031012",
  surface: "#072126",
  ink: "#e8fcfa",
  muted: "#91b7b6",
  line: "#1f5559",
  brand: "#42dfd0",
} as const;

export const EMAIL_FONT = "'Avenir Next',Avenir,Montserrat,'Segoe UI',Arial,sans-serif";

export function commonTimeEmailFrame(content: string) {
  return `<div style="margin:0;background:${EMAIL_COLORS.canvas};color:${EMAIL_COLORS.ink};font-family:${EMAIL_FONT};padding:40px 24px"><div style="max-width:600px;margin:0 auto;background:${EMAIL_COLORS.surface};padding:32px">${content}</div></div>`;
}
