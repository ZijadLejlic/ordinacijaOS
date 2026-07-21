/**
 * Generates §5.3 marketing WebP UI mocks (2×) from SVG — brand palette only.
 * Content panels for BrowserFrame; phone shots include device chrome.
 * Run: node scripts/generate-marketing-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/marketing/screenshots");

const INK = "#0F1B3D";
const ACCENT = "#0B6EF5";
const DEEP = "#0047C7";
const CYAN = "#2EC8F0";
const MIST = "#E8F4FF";
const WASH = "#F5FAFF";
const WHITE = "#FFFFFF";

const SHOTS = [
  { id: "signup", title: "Registracija", badge: "signup", variant: "form", rows: ["Email i lozinka", "Naziv ordinacije", "Bez kartice"] },
  { id: "onboarding-1", title: "Onboarding · korak 1", badge: "setup", variant: "form", rows: ["Adresa ordinacije", "Europe/Sarajevo", "Radno vrijeme"] },
  { id: "onboarding-2", title: "Onboarding · korak 2", badge: "setup", rows: ["Kontrola · 25 €", "Plomba · 45 €", "Higijena · 35 €"] },
  { id: "onboarding-3", title: "Onboarding · korak 3", badge: "setup", rows: ["Dr. Softić · doktor", "Recepcionarka · invite", "Uloga = prava"] },
  { id: "patients", title: "Pacijenti", badge: "UI", rows: ["Amina Hodžić", "Emir Begić", "Lejla Softić"] },
  { id: "chart", title: "Karton · Amina Hodžić", badge: "UI", rows: ["Alergije: penicilin", "Dokumenti: 3", "RTG: 2 snimka"] },
  { id: "odontogram", title: "Odontogram", badge: "FDI", variant: "odontogram" },
  { id: "plan", title: "Plan terapije", badge: "UI", rows: ["Plomba 16 · 45 €", "Higijena · 35 €", "Kontrola · zakazano"] },
  { id: "calendar", title: "Kalendar", badge: "week", variant: "calendar", rows: ["09:00 Amina", "10:30 Emir", "12:00 Lejla", "14:00 Haris"] },
  { id: "appointment-modal", title: "Novi termin", badge: "modal", variant: "form", rows: ["Pacijent: Emir Begić", "Doktor: Softić", "Uto 10:30 · 30 min"] },
  { id: "waitlist", title: "Waitlist", badge: "UI", rows: ["Otkazano: 11:00", "Predlog: Sara Delić", "Potvrdi zamjenu"] },
  { id: "invoice", title: "Faktura FA-2026-014", badge: "UI", rows: ["Plomba · 45 €", "PDV 17%", "Ukupno 52,65 €"] },
  { id: "payments", title: "Uplate i rate", badge: "UI", rows: ["Uplaćeno 30 €", "Preostalo 22,65 €", "2 rate"] },
  { id: "reports", title: "Izvještaji", badge: "UI", rows: ["Promet: 4.820 €", "Troškovi: 1.140 €", "Izvoz Excel"] },
  { id: "dashboard", title: "Dashboard", badge: "KPI", variant: "dashboard", rows: ["12 pacijenata", "480 € danas", "8 termina", "09:00 Amina · kontrola"] },
  { id: "crm", title: "CRM recall", badge: "UI", rows: ["Nisu dolazili 6+ mj", "12 kandidata", "Pošalji email"] },
  { id: "inventory", title: "Inventar", badge: "UI", rows: ["Kompozit A2 · nisko", "Rukavice · OK", "Anestetici · 14"] },
  { id: "settings", title: "Postavke · tim", badge: "UI", rows: ["Vlasnik · MFA", "Doktor Softić", "Audit log aktivan"] },
  { id: "reminder", title: "Email podsjetnik", badge: "UI", rows: ["Termin sutra 09:00", "Predložak na bosanskom", "Poslano automatski"] },
  { id: "mobile-calendar", title: "Kalendar", badge: "mobile", variant: "phone", phoneLabel: "Termini danas", rows: ["09:00 Amina", "10:30 Emir", "12:00 Lejla"] },
  { id: "mobile-chart", title: "Karton", badge: "mobile", variant: "phone", phoneLabel: "Amina Hodžić", rows: ["Alergije: penicilin", "Dokumenti: 3", "Odontogram"] },
];

function esc(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rowBlock(rows, y0) {
  return rows
    .map((row, i) => {
      const y = y0 + i * 56;
      const color = i === 0 ? ACCENT : i === 1 ? CYAN : DEEP;
      return `<rect x="40" y="${y}" width="1120" height="48" rx="12" fill="${WASH}"/><circle cx="64" cy="${y + 24}" r="6" fill="${color}"/><text x="86" y="${y + 30}" font-family="system-ui,sans-serif" font-size="22" fill="${INK}">${esc(row)}</text>`;
    })
    .join("");
}

function panel(inner, w = 1200, h = 720) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${WASH}"/>${inner}</svg>`;
}

function phonePanel(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="390" height="780" viewBox="0 0 390 780"><rect width="390" height="780" rx="28" fill="${INK}"/><rect x="10" y="10" width="370" height="760" rx="22" fill="${WHITE}"/><rect x="145" y="22" width="100" height="10" rx="5" fill="${INK}" opacity="0.12"/>${inner}</svg>`;
}

function buildSvg(shot) {
  const badge = shot.badge ?? "UI";
  const title = shot.title;

  if (shot.variant === "phone") {
    const rows = shot.rows ?? [];
    const label = shot.phoneLabel ?? title;
    const list = rows
      .map((row, i) => {
        const y = 110 + i * 70;
        return `<rect x="36" y="${y}" width="318" height="56" rx="12" fill="${WASH}"/><text x="52" y="${y + 34}" font-family="system-ui,sans-serif" font-size="16" fill="${INK}">${esc(row)}</text>`;
      })
      .join("");
    return phonePanel(
      `<text x="36" y="80" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="${INK}">${esc(label)}</text><rect x="270" y="58" width="84" height="28" rx="8" fill="${MIST}"/><text x="312" y="77" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="${ACCENT}">${esc(badge)}</text>${list}`,
    );
  }

  if (shot.variant === "odontogram") {
    const upper = Array.from({ length: 16 }, (_, i) => {
      const x = 140 + i * 56;
      const fill = i === 5 || i === 11 ? ACCENT : MIST;
      return `<rect x="${x}" y="160" width="44" height="44" rx="6" fill="${fill}"/>`;
    }).join("");
    const lower = Array.from({ length: 16 }, (_, i) => {
      const x = 140 + i * 56;
      const fill = i === 3 ? CYAN : MIST;
      return `<rect x="${x}" y="240" width="44" height="44" rx="6" fill="${fill}"/>`;
    }).join("");
    return panel(
      `<rect x="40" y="40" width="1120" height="640" rx="20" fill="${WHITE}"/><text x="64" y="88" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="${INK}">${esc(title)}</text><rect x="980" y="64" width="140" height="36" rx="8" fill="${MIST}"/><text x="1050" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${ACCENT}">${esc(badge)}</text>${upper}${lower}<circle cx="430" cy="150" r="16" fill="${ACCENT}"/><text x="430" y="156" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="${WHITE}">1</text><circle cx="766" cy="150" r="16" fill="${ACCENT}"/><text x="766" y="156" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="${WHITE}">2</text><circle cx="318" cy="310" r="16" fill="${ACCENT}"/><text x="318" y="316" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="${WHITE}">3</text><text x="64" y="380" font-family="system-ui,sans-serif" font-size="20" fill="${INK}" opacity="0.7">Zub 16 · karies · Zub 26 · plomba · Zub 36 · zdrav</text>`,
    );
  }

  if (shot.variant === "calendar") {
    const days = ["Pon", "Uto", "Sri", "Čet", "Pet"];
    const cells = days
      .map((d, i) => {
        const x = 56 + i * 220;
        const appt = shot.rows?.[i];
        return `<rect x="${x}" y="130" width="200" height="480" rx="14" fill="${WASH}"/><text x="${x + 16}" y="166" font-family="system-ui,sans-serif" font-size="18" fill="${INK}" opacity="0.6">${esc(d)}</text>${
          appt
            ? `<rect x="${x + 12}" y="190" width="176" height="56" rx="10" fill="${MIST}"/><text x="${x + 24}" y="224" font-family="system-ui,sans-serif" font-size="16" fill="${INK}">${esc(appt)}</text>`
            : ""
        }`;
      })
      .join("");
    return panel(
      `<rect x="40" y="40" width="1120" height="640" rx="20" fill="${WHITE}"/><text x="64" y="88" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="${INK}">${esc(title)}</text><rect x="980" y="64" width="140" height="36" rx="8" fill="${MIST}"/><text x="1050" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${ACCENT}">${esc(badge)}</text>${cells}`,
    );
  }

  if (shot.variant === "dashboard") {
    const kpis = (shot.rows ?? []).slice(0, 3);
    const kpiBlocks = kpis
      .map((label, i) => {
        const x = 64 + i * 360;
        const value = i === 0 ? "12" : i === 1 ? "480 €" : "8";
        return `<rect x="${x}" y="130" width="330" height="120" rx="16" fill="${WASH}"/><text x="${x + 24}" y="174" font-family="system-ui,sans-serif" font-size="18" fill="${INK}" opacity="0.55">${esc(label)}</text><text x="${x + 24}" y="222" font-family="Georgia,serif" font-size="36" font-weight="700" fill="${INK}">${value}</text>`;
      })
      .join("");
    const rest = (shot.rows ?? []).slice(3);
    return panel(
      `<rect x="40" y="40" width="1120" height="640" rx="20" fill="${WHITE}"/><text x="64" y="88" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="${INK}">${esc(title)}</text><rect x="980" y="64" width="140" height="36" rx="8" fill="${MIST}"/><text x="1050" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${ACCENT}">${esc(badge)}</text>${kpiBlocks}${rowBlock(rest.length ? rest : ["Današnji termini"], 290)}`,
    );
  }

  const rows = shot.rows ?? [];
  return panel(
    `<rect x="40" y="40" width="1120" height="640" rx="20" fill="${WHITE}"/><text x="64" y="88" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="${INK}">${esc(title)}</text><rect x="980" y="64" width="140" height="36" rx="8" fill="${MIST}"/><text x="1050" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${ACCENT}">${esc(badge)}</text>${rowBlock(rows, 130)}${
      shot.variant === "form"
        ? `<rect x="64" y="360" width="280" height="52" rx="12" fill="${ACCENT}"/><text x="204" y="394" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="${WHITE}">Nastavi</text>`
        : ""
    }`,
  );
}

mkdirSync(OUT, { recursive: true });

for (const shot of SHOTS) {
  const file = join(OUT, `${shot.id}.webp`);
  await sharp(Buffer.from(buildSvg(shot)), { density: 144 })
    .webp({ quality: 88, effort: 4 })
    .toFile(file);
  console.log("wrote", file);
}

writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      shots: SHOTS.map((s) => s.id),
      note: "Content panels for BrowserFrame; phone shots include device chrome.",
    },
    null,
    2,
  ),
);
console.log(`Done: ${SHOTS.length} WebP screenshots → ${OUT}`);
